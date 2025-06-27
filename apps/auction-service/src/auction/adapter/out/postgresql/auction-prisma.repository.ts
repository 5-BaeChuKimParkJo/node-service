import { PrismaService } from 'apps/auction-service/src/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AuctionRepositoryPort, TX } from '../../../application/port/out/auction-repository.port';
import AuctionForCreateDomain from '../../../domain/model/auction-for-create.domain';
import AuctionDomain from '../../../domain/model/auction.domain';
import { auctionPropsSchema } from '../../../domain/schema/auction.schema';
import AuctionForUpdateDomain from '../../../domain/model/auction-for-update.domain';
import AuctionForDeleteDomain from '../../../domain/model/auction-for-delete.domain';
import {
  AuctionBiddersReturn,
  Auctions,
  AuctionsAdminReturn,
  AuctionsReturn,
} from '../../../application/port/out/auction-repository.port.type';
import AuctionBidderForCreateDomain from '../../../domain/model/auction-bidder-for-create.domain';
import AuctionBidderDomain from '../../../domain/model/auction-bidder.domain';
import { ErrorCode, AppException, KafkaAuctionServiceOutboxTopicValue } from '@app/common';
import { AuctionCommand } from '../../../application/port/dto/auction.command';
import { AuctionAdminCommand } from '../../../application/port/dto/auction-admin.command';
import AuctionAdminDomain from '../../../domain/model/auction-admin.domain';
import { auctionAdminPropsSchema } from '../../../domain/schema/auction-admin.schema';
import { AuctionsCommand } from '../../../application/port/dto/auctions.command';
import { AuctionsAdminCommand } from '../../../application/port/dto/auctions-admin.command';
import { AuctionBiddersCommand } from '../../../application/port/dto/auction-bidders.command';
import { AuctionsByIdsCommand } from '../../../application/port/dto/auctions-by-ids.command';
import { AuctionsByIdsAdminCommand } from '../../../application/port/dto/auctions-by-ids-admin.command';
import { toNumber } from '@app/common/utils/number.utils';
import { S3Service } from '@app/common/s3/s3.service';
import AuctionBidderForCreateBulkDomain from '../../../domain/model/auction-bidder-for-create-bulk.domain';
import AuctionViewedForCreateBulkDomain from '../../../domain/model/auction-viewed-for-create-bulk.domain';

@Injectable()
export class AuctionPrismaRepository extends AuctionRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {
    super();
    this.findAuction = this.findAuction.bind(this);
    this.findAuctions = this.findAuctions.bind(this);
    this.findAuctionsByIds = this.findAuctionsByIds.bind(this);
  }

  override transaction = async <T>(
    fn: (tx: TX) => Promise<T>,
    args?: {
      isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
      maxWait?: number;
      timeout?: number;
    },
  ): Promise<T> => {
    return await this.prisma.$transaction(fn, args);
  };

  override findAuction(args: AuctionCommand): Promise<AuctionDomain>;
  override findAuction(args: AuctionAdminCommand): Promise<AuctionAdminDomain>;
  override async findAuction({
    type,
    auctionUuid,
  }: AuctionCommand | AuctionAdminCommand): Promise<AuctionDomain | AuctionAdminDomain> {
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
      return new AuctionDomain(auctionPropsSchema.parse({ ...row, images: row.auctionImages }));
    } else if (type === 'admin') {
      return new AuctionAdminDomain(auctionAdminPropsSchema.parse({ ...row, images: row.auctionImages }));
    } else {
      const _exhaustiveCheck: never = type;
      throw new AppException(
        { message: _exhaustiveCheck + '는 유효하지 않은 타입입니다.', code: ErrorCode.INTERNAL_VALIDATION_ERROR },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  override findAcutionForUpdate = async (auctionUuid: string, tx?: TX): Promise<AuctionDomain> => {
    const prisma = tx ?? this.prisma;
    const res = await prisma.$queryRaw<Auctions[]>`
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
    return new AuctionDomain({
      ...res[0],
      status: 'visible',
      images: [],
    });
  };

  override findAuctionsByIds(args: AuctionsByIdsCommand): Promise<AuctionDomain[]>;
  override findAuctionsByIds(args: AuctionsByIdsAdminCommand): Promise<AuctionAdminDomain[]>;
  override async findAuctionsByIds({
    type,
    ids,
  }: AuctionsByIdsCommand | AuctionsByIdsAdminCommand): Promise<AuctionDomain[] | AuctionAdminDomain[]> {
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
          new AuctionDomain({
            ...row,
            status: 'visible',
            images: row.auctionImages,
          }),
      );
    } else if (type === 'admin') {
      return rows.map(
        (row) =>
          new AuctionAdminDomain({
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

  override findHighestBidder = async (auctionUuid: string): Promise<AuctionBidderDomain | undefined> => {
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
      ? new AuctionBidderDomain({
          ...auctionBidder,
          auctionUuid: auction.auctionUuid,
        })
      : undefined;
  };

  override findAuctions(args: AuctionsCommand): Promise<AuctionsReturn>;
  override findAuctions(args: AuctionsAdminCommand): Promise<AuctionsAdminReturn>;
  override async findAuctions({
    type,
    cursor,
  }: AuctionsCommand | AuctionsAdminCommand): Promise<AuctionsReturn | AuctionsAdminReturn> {
    const limit = 20;
    const pageSize = limit + 1;

    const rows = await this.prisma.auctions.findMany({
      where: {
        ...(type === 'user' && { status: { notIn: ['hidden', 'cancelled'] }, deletedAt: null }),
        ...(cursor && {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { AND: [{ createdAt: cursor.createdAt }, { auctionUuid: { lt: cursor.auctionUuid } }] },
          ],
        }),
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
            new AuctionDomain({
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
            new AuctionAdminDomain({
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

  override createAuction = async (auctionForCreateDomain: AuctionForCreateDomain): Promise<AuctionDomain> => {
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
      const auctionDomain = new AuctionDomain(auctionPropsSchema.parse({ ...row, images: auctionImages }));
      await this.createAuctionOutbox(auctionDomain, 'c', tx);
      return auctionDomain;
    });
  };

  override updateAuction = async (auctionForUpdate: AuctionForUpdateDomain): Promise<AuctionDomain> => {
    const { images, auctionUuid, ...auction } = auctionForUpdate.getSnapshot();
    return await this.prisma.$transaction(async (tx) => {
      const { auctionImages, ...row } = await tx.auctions.update({
        where: { auctionUuid },
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
      const auctionDomain = new AuctionDomain(auctionPropsSchema.parse({ ...row, images: auctionImages }));
      await this.createAuctionOutbox(auctionDomain, 'u', tx);
      return auctionDomain;
    });
  };

  override updateAuctionCurrent = async (
    auctionUuid: string,
    currentBid: bigint,
    currentBidderUuid: string,
    tx?: TX,
  ): Promise<void> => {
    const prisma = tx ?? this.prisma;
    await prisma.auctions.update({
      where: { auctionUuid },
      data: { currentBid, currentBidderUuid },
    });
  };

  override deleteAuction = async (auctionForDelete: AuctionForDeleteDomain): Promise<void> => {
    const { auctionUuid } = auctionForDelete.getSnapshot();
    return await this.prisma.$transaction(async (tx) => {
      const { auctionImages, ...row } = await tx.auctions.update({
        where: { auctionUuid },
        data: { deletedAt: new Date() },
        include: {
          auctionImages: true,
        },
      });
      const auctionDomain = new AuctionDomain(auctionPropsSchema.parse({ ...row, images: auctionImages }));
      await this.createAuctionOutbox(auctionDomain, 'd', tx);
    });
  };

  override createAuctionBidder = async (auctionBidder: AuctionBidderForCreateDomain, tx?: TX): Promise<void> => {
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

  override createAuctionBidders = async (auctionBidders: AuctionBidderForCreateBulkDomain, tx?: TX): Promise<void> => {
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
    tx?: TX,
  ): Promise<number> => {
    const prisma = tx ?? this.prisma;
    const res = await prisma.auctions.updateMany({
      where: { auctionUuid, currentBid: { lt: bidAmount } },
      data: { currentBid: bidAmount, currentBidderUuid: bidderUuid },
    });
    return res.count;
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
      items: items.map((row) => new AuctionBidderDomain({ ...row, auctionUuid })),
      nextCursor,
    };
  };

  private createAuctionOutbox = async (auction: AuctionDomain, op: 'c' | 'u' | 'd', tx?: TX): Promise<void> => {
    const prisma = tx ?? this.prisma;
    const snapshot = auction.getSnapshot();
    const { auctionId: _, ...row } = snapshot;
    const auctionChangedValue: KafkaAuctionServiceOutboxTopicValue = {
      aggregateType: 'auction',
      aggregateId: snapshot.auctionUuid,
      eventType: op === 'c' ? 'AuctionCreated' : op === 'u' ? 'AuctionUpdated' : 'AuctionDeleted',
      op,
      payload: {
        ...row,
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
    auctionViewed: AuctionViewedForCreateBulkDomain,
    tx?: TX,
  ): Promise<void> => {
    const prisma = tx ?? this.prisma;
    await prisma.auctionViewed.createMany({
      data: auctionViewed.getSnapshot(),
    });
  };
}
