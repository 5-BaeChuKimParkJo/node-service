import { PrismaService } from 'apps/auction-service/src/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AuctionRepositoryPort, AuctionBidSession } from '../../../application/port/out/auction-repository.port';
import NewAuction from '../../../domain/model/new-auction';
import Auction from '../../../domain/model/auction';
import { auctionPropsSchema } from '../../../domain/schema/auction.schema';
import AuctionUpdate from '../../../domain/model/auction-update';
import AuctionDeletion from '../../../domain/model/auction-deletion';
import {
  AuctionBiddersReturn,
  AdminAuctionActionArgs,
  AdminAuctionBidRecord,
  AdminAuctionBidsReturn,
  AuctionsAdminReturn,
  AuctionsReturn,
} from '../../../application/port/out/auction-repository.port.type';
import NewBid from '../../../domain/model/new-bid';
import AuctionBid from '../../../domain/model/auction-bid';
import { ErrorCode } from '@app/common/common/const';
import { AppException } from '@app/common/common/app.exception';
import { KafkaAuctionServiceOutboxTopicValue } from '@app/common/schema/kafka-auction-service-outbox-topic.schema';
import { AuctionCommand } from '../../../application/model/auction.command';
import { AuctionAdminCommand } from '../../../application/model/auction-admin.command';
import { AuctionAdminBidsCommand } from '../../../application/model/auction-admin-bids.command';
import AdminAuction from '../../../domain/model/admin-auction';
import { auctionAdminPropsSchema } from '../../../domain/schema/auction-admin.schema';
import { AuctionsCommand } from '../../../application/model/auctions.command';
import { AuctionsAdminCommand } from '../../../application/model/auctions-admin.command';
import { AuctionBiddersCommand } from '../../../application/model/auction-bidders.command';
import { AuctionsByIdsCommand } from '../../../application/model/auctions-by-ids.command';
import { AuctionsByIdsAdminCommand } from '../../../application/model/auctions-by-ids-admin.command';
import { toNumber } from '@app/common/utils/number.utils';
import { S3Service } from '@app/common/s3/s3.service';
import NewBidBatch from '../../../domain/model/new-bid-batch';
import AuctionViewBatch from '../../../domain/model/auction-view-batch';
import { randomUUID } from 'crypto';
import { TaxonomyUseCase } from '../../../../taxonomy/application/port/in/taxonomy.use-case';
import { Prisma } from 'apps/auction-service/src/prisma/generated';
import { z } from 'zod';

@Injectable()
export class AuctionPrismaAdapter extends AuctionRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly taxonomyService: TaxonomyUseCase,
  ) {
    super();
    this.findAuction = this.findAuction.bind(this);
    this.findAuctions = this.findAuctions.bind(this);
    this.findAuctionsByIds = this.findAuctionsByIds.bind(this);
  }

  override withLockedAuction = async <T>(
    uuid: string,
    work: (session: AuctionBidSession) => Promise<T>,
  ): Promise<T> => {
    return this.prisma.$transaction(async (tx) => {
      const auction = await this.findAuctionForUpdate(uuid, tx);
      return work({
        auction,
        createBid: (bidder) => this.createAuctionBidder(bidder, tx),
        createBids: (bidders) => this.createAuctionBidders(bidders, tx),
        updateCurrent: (amount, bidder) => this.updateAuctionCurrent(uuid, amount, bidder, tx),
        updateCurrentBid: (amount, bidder) => this.updateAuctionCurrentBid(uuid, amount, bidder, tx),
      });
    });
  };

  override findAuction(args: AuctionCommand): Promise<Auction>;
  override findAuction(args: AuctionAdminCommand): Promise<AdminAuction>;
  override async findAuction({
    type,
    auctionUuid,
  }: AuctionCommand | AuctionAdminCommand): Promise<Auction | AdminAuction> {
    const row = await this.prisma.auctions.findUnique({
      where: {
        auctionUuid,
        ...(type === 'user' && { status: { notIn: ['hidden', 'cancelled'] }, deletedAt: null }),
      },
      include: {
        auctionImages: true,
      },
    });
    if (!row) {
      throw new AppException(
        { message: '해당 경매를 찾을 수 없습니다.', code: ErrorCode.NOT_FOUND },
        HttpStatus.NOT_FOUND,
      );
    }

    if (type === 'user') {
      return new Auction(auctionPropsSchema.parse({ ...row, images: row.auctionImages }));
    } else if (type === 'admin') {
      return new AdminAuction(auctionAdminPropsSchema.parse({ ...row, images: row.auctionImages }));
    } else {
      const _exhaustiveCheck: never = type;
      throw new AppException(
        { message: _exhaustiveCheck + '는 유효하지 않은 타입입니다.', code: ErrorCode.INTERNAL_VALIDATION_ERROR },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  findAuctionForUpdate = async (auctionUuid: string, tx?: Prisma.TransactionClient): Promise<Auction> => {
    const prisma = tx ?? this.prisma;
    const res = await prisma.$queryRaw<Prisma.AuctionsGetPayload<{}>[]>`
      SELECT *
      FROM "Auctions"
      WHERE "auctionUuid" = ${auctionUuid}::uuid
      FOR UPDATE;
    `;

    if (res.length === 0) {
      throw new AppException(
        { message: '해당 경매를 찾을 수 없습니다.', code: ErrorCode.NOT_FOUND },
        HttpStatus.NOT_FOUND,
      );
    }
    return new Auction({
      ...res[0],
      status: 'visible',
      images: [],
    });
  };

  override findAuctionsByIds(args: AuctionsByIdsCommand): Promise<Auction[]>;
  override findAuctionsByIds(args: AuctionsByIdsAdminCommand): Promise<AdminAuction[]>;
  override async findAuctionsByIds({
    type,
    ids,
  }: AuctionsByIdsCommand | AuctionsByIdsAdminCommand): Promise<Auction[] | AdminAuction[]> {
    const rows = await this.prisma.auctions.findMany({
      where: {
        auctionUuid: { in: ids },
        ...(type === 'user' && { status: { notIn: ['hidden', 'cancelled'] }, deletedAt: null }),
      },
      include: {
        auctionImages: true,
      },
    });
    if (type === 'user') {
      return rows.map(
        (row) =>
          new Auction({
            ...row,
            status: 'visible',
            images: row.auctionImages,
          }),
      );
    } else if (type === 'admin') {
      return rows.map(
        (row) =>
          new AdminAuction({
            ...row,
            images: row.auctionImages,
          }),
      );
    } else {
      const _exhaustiveCheck: never = type;
      throw new AppException(
        { message: _exhaustiveCheck + '는 유효하지 않은 타입입니다.', code: ErrorCode.INTERNAL_VALIDATION_ERROR },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  override findHighestBidder = async (auctionUuid: string): Promise<AuctionBid | undefined> => {
    const auction = await this.prisma.auctions.findUnique({
      where: { auctionUuid },
    });

    if (!auction) {
      throw new AppException(
        { message: '해당 경매를 찾을 수 없습니다.', code: ErrorCode.NOT_FOUND },
        HttpStatus.NOT_FOUND,
      );
    }

    const auctionBidder = await this.prisma.auctionBidders.findFirst({
      where: { auctionId: auction.auctionId },
      orderBy: { bidAmount: 'desc' },
    });

    return auctionBidder
      ? new AuctionBid({
          ...auctionBidder,
          auctionUuid: auction.auctionUuid,
        })
      : undefined;
  };

  override findAuctions(args: AuctionsCommand): Promise<AuctionsReturn>;
  override findAuctions(args: AuctionsAdminCommand): Promise<AuctionsAdminReturn>;
  override async findAuctions(
    command: AuctionsCommand | AuctionsAdminCommand,
  ): Promise<AuctionsReturn | AuctionsAdminReturn> {
    const { type, cursor } = command;
    const limit = 20;
    const pageSize = limit + 1;
    const now = new Date();
    const query = type === 'admin' ? command.query : undefined;
    const status = type === 'admin' ? command.status : undefined;

    const filters: Prisma.AuctionsWhereInput[] = [];
    if (type === 'admin' && query) {
      filters.push({
        OR: [
          { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
          ...(z.string().uuid().safeParse(query).success ? [{ auctionUuid: query }] : []),
        ],
      });
    }
    if (type === 'admin' && status) filters.push(this.adminStatusWhere(status, now));
    if (cursor) {
      filters.push({
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { AND: [{ createdAt: cursor.createdAt }, { auctionUuid: { lt: cursor.auctionUuid } }] },
        ],
      });
    }

    const rows = await this.prisma.auctions.findMany({
      where: {
        ...(type === 'user' && { status: { notIn: ['hidden', 'cancelled'] }, deletedAt: null }),
        ...(filters.length > 0 && { AND: filters }),
      },
      include: {
        auctionImages: true,
      },
      orderBy: [{ createdAt: 'desc' }, { auctionUuid: 'desc' }],
      take: pageSize,
    });
    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];
    const nextCursor = hasNext
      ? {
          createdAt: lastItem.createdAt,
          auctionUuid: lastItem.auctionUuid,
        }
      : null;

    if (type === 'user') {
      return {
        items: items.map(
          (row) =>
            new Auction({
              ...row,
              status: 'visible',
              images: row.auctionImages,
            }),
        ),
        nextCursor,
      };
    } else if (type === 'admin') {
      return {
        items: items.map(
          (row) =>
            new AdminAuction({
              ...row,
              images: row.auctionImages,
            }),
        ),
        nextCursor,
      };
    } else {
      const _exhaustiveCheck: never = type;
      throw new AppException(
        { message: _exhaustiveCheck + '는 유효하지 않은 타입입니다.', code: ErrorCode.INTERNAL_VALIDATION_ERROR },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  override createAuction = async (auctionForCreateDomain: NewAuction): Promise<Auction> => {
    const { images, ...auction } = auctionForCreateDomain.getSnapshot();
    return await this.prisma.$transaction(async (tx) => {
      const { auctionImages, ...row } = await tx.auctions.create({
        include: {
          auctionImages: true,
        },
        data: {
          ...auction,
          auctionImages: {
            createMany: {
              data: images,
            },
          },
        },
      });
      const auctionDomain = new Auction(auctionPropsSchema.parse({ ...row, images: auctionImages }));
      await this.createAuctionOutbox(auctionDomain, 'c', tx);
      return auctionDomain;
    });
  };

  override updateAuction = async (auctionForUpdate: AuctionUpdate): Promise<Auction> => {
    const { images, auctionUuid, ...auction } = auctionForUpdate.getSnapshot();
    return await this.prisma.$transaction(async (tx) => {
      const { auctionImages, ...row } = await tx.auctions.update({
        where: { auctionUuid, checkoutLockedAt: null },
        include: {
          auctionImages: true,
        },
        data: {
          ...auction,
          ...(images && {
            auctionImages: {
              deleteMany: {},
              createMany: {
                data: images,
              },
            },
          }),
          version: { increment: 1 },
        },
      });
      const auctionDomain = new Auction(auctionPropsSchema.parse({ ...row, images: auctionImages }));
      await this.createAuctionOutbox(auctionDomain, 'u', tx);
      return auctionDomain;
    });
  };

  override updateAuctionCurrent = async (
    auctionUuid: string,
    currentBid: bigint,
    currentBidderUuid: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> => {
    const prisma = tx ?? this.prisma;
    const res = await prisma.auctions.update({
      include: { auctionImages: true },
      where: this.openBidWhere(auctionUuid, currentBid),
      data: { currentBid, currentBidderUuid },
    });
    const auctionDomain = new Auction(auctionPropsSchema.parse({ ...res, images: res.auctionImages }));
    await this.createAuctionOutbox(auctionDomain, 'u', tx);
  };

  override deleteAuction = async (auctionForDelete: AuctionDeletion): Promise<void> => {
    const { auctionUuid } = auctionForDelete.getSnapshot();
    return await this.prisma.$transaction(async (tx) => {
      const { auctionImages, ...row } = await tx.auctions.update({
        where: { auctionUuid },
        data: { deletedAt: new Date() },
        include: {
          auctionImages: true,
        },
      });
      const auctionDomain = new Auction(auctionPropsSchema.parse({ ...row, images: auctionImages }));
      await this.createAuctionOutbox(auctionDomain, 'd', tx);
    });
  };

  override createAuctionBidder = async (auctionBidder: NewBid, tx?: Prisma.TransactionClient): Promise<void> => {
    const prisma = tx ?? this.prisma;
    const { auctionId, bidAmount, bidderUuid } = auctionBidder.getSnapshot();

    await prisma.auctionBidders.create({
      data: {
        bidderUuid,
        bidAmount,
        auctionId,
      },
    });
  };

  override createAuctionBidders = async (auctionBidders: NewBidBatch, tx?: Prisma.TransactionClient): Promise<void> => {
    const prisma = tx ?? this.prisma;
    await prisma.auctionBidders.createMany({
      data: auctionBidders.getSnapshot().map((bidder) => ({
        auctionId: bidder.auctionId,
        bidAmount: bidder.bidAmount,
        bidderUuid: bidder.bidderUuid,
        createdAt: bidder.createdAt,
      })),
    });
  };

  override updateAuctionCurrentBid = async (
    auctionUuid: string,
    bidAmount: bigint,
    bidderUuid: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> => {
    const prisma = tx ?? this.prisma;
    try {
      const res = await prisma.auctions.update({
        include: { auctionImages: true },
        where: this.openBidWhere(auctionUuid, bidAmount),
        data: { currentBid: bidAmount, currentBidderUuid: bidderUuid },
      });
      const auctionDomain = new Auction(auctionPropsSchema.parse({ ...res, images: res.auctionImages }));
      await this.createAuctionOutbox(auctionDomain, 'u', tx);
      return 1;
    } catch (e) {
      return 0;
    }
  };

  override findAuctionBidders = async ({
    auctionUuid,
    cursor,
  }: AuctionBiddersCommand): Promise<AuctionBiddersReturn> => {
    const limit = 20;
    const pageSize = limit + 1;

    const auction = await this.prisma.auctions.findUnique({
      where: { auctionUuid },
    });

    if (!auction) {
      throw new AppException(
        { message: '해당 경매를 찾을 수 없습니다.', code: ErrorCode.NOT_FOUND },
        HttpStatus.NOT_FOUND,
      );
    }

    const rows = await this.prisma.auctionBidders.findMany({
      where: {
        auctionId: auction.auctionId,
        ...(cursor && {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { AND: [{ createdAt: cursor.createdAt }, { bidAmount: cursor.bidAmount }] },
          ],
        }),
      },
      orderBy: { bidAmount: 'desc' },
      take: pageSize,
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];
    const nextCursor = hasNext
      ? {
          bidAmount: lastItem.bidAmount,
          createdAt: lastItem.createdAt,
        }
      : null;

    return {
      items: items.map((row) => new AuctionBid({ ...row, auctionUuid })),
      nextCursor,
    };
  };

  override findAdminBids = async ({
    auctionUuid,
    cursor,
  }: AuctionAdminBidsCommand): Promise<AdminAuctionBidsReturn> => {
    return this.prisma.$transaction(
      async (tx) => {
        const auction = await tx.auctions.findUnique({
          where: { auctionUuid },
          select: { auctionId: true },
        });
        if (!auction) {
          throw new AppException(
            { message: '해당 경매를 찾을 수 없습니다.', code: ErrorCode.NOT_FOUND },
            HttpStatus.NOT_FOUND,
          );
        }

        const totalCount = await tx.auctionBidders.count({ where: { auctionId: auction.auctionId, deletedAt: null } });
        // Prisma Date values truncate microseconds, so select the cursor timestamp as ISO text.
        const rows = await tx.$queryRaw<AdminAuctionBidRecord[]>(Prisma.sql`
        SELECT "auctionBidderUuid", "bidderUuid", "bidAmount",
          to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt"
        FROM "AuctionBidders"
        WHERE "auctionId" = ${auction.auctionId} AND "deletedAt" IS NULL
        ${cursor ? Prisma.sql`AND ("createdAt", "auctionBidderUuid") < (${cursor.createdAt}::timestamptz, ${cursor.auctionBidderUuid}::uuid)` : Prisma.empty}
        ORDER BY "AuctionBidders"."createdAt" DESC, "auctionBidderUuid" DESC
        LIMIT 21
      `);
        const hasNext = rows.length > 20;
        const items = rows.slice(0, 20);
        const lastItem = items[items.length - 1];
        return {
          items,
          totalCount,
          nextCursor: hasNext ? { createdAt: lastItem.createdAt, auctionBidderUuid: lastItem.auctionBidderUuid } : null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  };

  private createAuctionOutbox = async (
    auction: Auction,
    op: 'c' | 'u' | 'd',
    tx?: Prisma.TransactionClient,
  ): Promise<void> => {
    const prisma = tx ?? this.prisma;
    const snapshot = auction.getSnapshot();
    const { auctionId: _, ...row } = snapshot;
    const taxonomy = await this.taxonomyService.resolveNames(row.categoryId, row.tagIds);
    const auctionChangedValue: KafkaAuctionServiceOutboxTopicValue = {
      aggregateType: 'auction',
      aggregateId: snapshot.auctionUuid,
      eventType: op === 'c' ? 'AuctionCreated' : op === 'u' ? 'AuctionUpdated' : 'AuctionDeleted',
      op,
      payload: {
        ...row,
        ...taxonomy,
        currentBid: toNumber(row.currentBid),
        minimumBid: toNumber(row.minimumBid),
        viewCount: toNumber(row.viewCount),
        thumbnailUrl: this.s3Service.toFullUrl(row.thumbnailKey),
        images: snapshot.images.map((image) => ({
          ...image,
          auctionImageId: toNumber(image.auctionImageId),
          url: this.s3Service.toFullUrl(image.key),
        })),
      },
    };
    await prisma.outbox.create({ data: auctionChangedValue });
  };

  override createAuctionViewedBulk = async (
    auctionViewed: AuctionViewBatch,
    tx?: Prisma.TransactionClient,
  ): Promise<void> => {
    const prisma = tx ?? this.prisma;
    await prisma.auctionViewed.createMany({
      data: auctionViewed.getSnapshot(),
    });
  };

  override applyAdminAction = async ({
    auctionUuid,
    action,
    actor,
    reason,
    now = new Date(),
  }: AdminAuctionActionArgs): Promise<AdminAuction> => {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.auctions.findUnique({
        where: { auctionUuid },
        include: { auctionImages: true },
      });
      if (!current) {
        throw new AppException(
          { message: '해당 경매를 찾을 수 없습니다.', code: ErrorCode.NOT_FOUND },
          HttpStatus.NOT_FOUND,
        );
      }

      const currentDomain = new AdminAuction(
        auctionAdminPropsSchema.parse({ ...current, images: current.auctionImages }),
      );
      const plan = currentDomain.planAction(action, now);
      const updated = await tx.auctions.update({
        where: { auctionUuid, version: current.version },
        include: { auctionImages: true },
        data: {
          status: plan.persistedStatus,
          endAt: plan.endAt,
          version: { increment: 1 },
        },
      });
      const updatedDomain = new AdminAuction(
        auctionAdminPropsSchema.parse({ ...updated, images: updated.auctionImages }),
      );

      await tx.auctionAdminActions.create({
        data: {
          auctionUuid,
          actor,
          action,
          reason,
          previousStatus: plan.previousStatus,
          nextStatus: plan.nextStatus,
        },
      });

      const eventDomain = new Auction(
        auctionPropsSchema.parse({ ...updated, status: 'visible', images: updated.auctionImages }),
      );
      await this.createAuctionOutbox(eventDomain, action === 'hide' ? 'd' : 'u', tx);
      return updatedDomain;
    });
  };

  override findAdminActions = async (auctionUuid: string) => {
    return this.prisma.auctionAdminActions.findMany({
      where: { auctionUuid },
      select: {
        auctionAdminActionId: true,
        actor: true,
        action: true,
        reason: true,
        previousStatus: true,
        nextStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  };

  private adminStatusWhere = (
    status: NonNullable<AuctionsAdminCommand['status']>,
    now: Date,
  ): Prisma.AuctionsWhereInput => {
    if (status === 'hidden' || status === 'cancelled') return { status };
    if (status === 'waiting') return { status: 'visible', startAt: { gt: now } };
    if (status === 'active') return { status: 'visible', startAt: { lte: now }, endAt: { gt: now } };
    return { status: 'visible', endAt: { lte: now } };
  };

  private openBidWhere(auctionUuid: string, bidAmount: bigint): Prisma.AuctionsWhereUniqueInput {
    const now = new Date();
    return {
      auctionUuid,
      currentBid: { lt: bidAmount },
      status: 'visible',
      deletedAt: null,
      soldAt: null,
      checkoutLockedAt: null,
      startAt: { lte: now },
      endAt: { gt: now },
    };
  }
}
