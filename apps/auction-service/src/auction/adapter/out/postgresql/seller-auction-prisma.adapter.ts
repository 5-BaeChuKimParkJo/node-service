import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Auctions } from '../../../../prisma/generated';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SellerAuctionPort } from '../../../application/port/out/seller-auction.port';
import type { SellerAuctionChange } from '../../../application/model/seller-auction.command';
import type { SellerAuctionResult, SellerAuctionSnapshot } from '../../../application/model/seller-auction.result';
import { sellerAuctionEditable, sellerAuctionStatus } from '../../../domain/model/seller-auction-policy';
import Auction from '../../../domain/model/auction';
import { auctionPropsSchema } from '../../../domain/schema/auction.schema';
import { S3Service } from '@app/common/s3/s3.service';
import { TaxonomyUseCase } from '../../../../taxonomy/application/port/in/taxonomy.use-case';
import { writeAuctionOutbox } from './auction-outbox';

const include = { _count: { select: { auctionBidders: true } }, purchase: { select: { purchaseUuid: true } } } as const;
const snapshot = (row: Auctions): SellerAuctionSnapshot => ({
  title: row.title,
  description: row.description,
  minimumBid: row.minimumBid.toString(),
  startAt: row.startAt.toISOString(),
  endAt: row.endAt.toISOString(),
  status: row.status,
});
@Injectable()
export class SellerAuctionPrismaAdapter extends SellerAuctionPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: S3Service,
    private readonly taxonomy: TaxonomyUseCase,
  ) {
    super();
  }
  override read(memberUuid: string, auctionUuid: string): Promise<SellerAuctionResult | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.auctions.findFirst({
          where: { auctionUuid, sellerUuid: memberUuid, deletedAt: null },
          include,
        });
        if (!row) return null;
        const history = await tx.auctionSellerAction.findMany({
          where: { auctionUuid, sellerUuid: memberUuid },
          orderBy: [{ createdAt: 'desc' }, { actionUuid: 'desc' }],
          take: 20,
        });
        const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
        return {
          ...snapshot(row),
          auctionUuid,
          version: row.version,
          status: sellerAuctionStatus(row, clock.now),
          editable: sellerAuctionEditable(
            { ...row, bidCount: row._count.auctionBidders, hasPurchase: row.purchase !== null },
            clock.now,
          ),
          history: history.map((item) => ({
            action: item.action,
            reasonCode: item.reasonCode,
            reasonDetail: item.reasonDetail,
            before: item.beforeSnapshot as unknown as SellerAuctionSnapshot,
            after: item.afterSnapshot as unknown as SellerAuctionSnapshot,
            createdAt: item.createdAt.toISOString(),
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  override async change(memberUuid: string, auctionUuid: string, command: SellerAuctionChange): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<
          Array<{ auctionUuid: string }>
        >`SELECT "auctionUuid" FROM "Auctions" WHERE "auctionUuid"=${auctionUuid}::uuid AND "sellerUuid"=${memberUuid}::uuid AND "deletedAt" IS NULL FOR UPDATE`;
        if (!locked.length) throw new NotFoundException('Seller auction not found');
        const row = await tx.auctions.findUniqueOrThrow({ where: { auctionUuid }, include });
        const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
        if (
          row.version !== command.version ||
          !sellerAuctionEditable(
            { ...row, bidCount: row._count.auctionBidders, hasPurchase: row.purchase !== null },
            clock.now,
          )
        )
          throw new ConflictException('Seller auction is no longer editable');
        const changes =
          command.action === 'update'
            ? Prisma.sql`"title"=${command.title},"description"=${command.description},"minimumBid"=${BigInt(command.minimumBid)},"startAt"=${command.startAt},"endAt"=${command.endAt}`
            : Prisma.sql`"status"='cancelled'::"AuctionStatus"`;
        const future =
          command.action === 'update'
            ? Prisma.sql`AND ${command.startAt}::timestamptz > clock_timestamp()`
            : Prisma.empty;
        const changed = await tx.$queryRaw<
          Auctions[]
        >`UPDATE "Auctions" SET ${changes},"version"="version"+1,"updatedAt"=clock_timestamp()
        WHERE "auctionUuid"=${auctionUuid}::uuid AND "sellerUuid"=${memberUuid}::uuid AND "version"=${command.version}
        AND "status"='visible' AND "deletedAt" IS NULL AND "startAt">clock_timestamp() AND "endAt">clock_timestamp()
        AND "currentBid"=0 AND "currentBidderUuid" IS NULL AND "soldAt" IS NULL AND "checkoutLockedAt" IS NULL
        AND NOT EXISTS(SELECT 1 FROM "AuctionBidders" b WHERE b."auctionId"="Auctions"."auctionId")
        AND NOT EXISTS(SELECT 1 FROM "AuctionPurchase" p WHERE p."auctionUuid"="Auctions"."auctionUuid") ${future} RETURNING *`;
        if (!changed.length) throw new ConflictException('Seller auction changed while saving');
        const updated = changed[0];
        await tx.auctionSellerAction.create({
          data: {
            auctionUuid,
            sellerUuid: memberUuid,
            action: command.action,
            reasonCode: command.action === 'cancel' ? command.reasonCode : null,
            reasonDetail: command.action === 'cancel' ? (command.reasonDetail ?? null) : null,
            beforeSnapshot: snapshot(row) as unknown as Prisma.InputJsonValue,
            afterSnapshot: snapshot(updated) as unknown as Prisma.InputJsonValue,
          },
        });
        const images = await tx.auctionImages.findMany({ where: { auctionId: row.auctionId } });
        const event = new Auction(auctionPropsSchema.parse({ ...updated, status: 'visible', images }));
        await writeAuctionOutbox(event, command.action === 'cancel' ? 'd' : 'u', tx, this.taxonomy, this.media);
      },
      { timeout: 10000 },
    );
  }
}
