import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ErrorCode,
  isTimeTruncated,
  KafkaAuctionServiceOutboxTopicValue,
  kafkaAuctionServiceOutboxTopicValueSchema,
  toNumber,
  User,
} from '@app/common';
import * as TE from 'fp-ts/TaskEither';
import { AppException } from '@app/common/common/app.exception';
import { Auctions, Prisma } from '../prisma/generated';
import * as F from 'fp-ts/function';
import { TX } from '../auction/application/port/out/auction-repository.port';
import { S3Service } from '@app/common/s3/s3.service';
import { z } from 'zod';

@Injectable()
export class AuctionEtcRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  findMyBids = (user: User): TE.TaskEither<AppException, Prisma.AuctionBiddersGetPayload<{}>[]> => {
    return TE.tryCatch(
      () =>
        this.prisma.auctionBidders.findMany({
          where: {
            bidderUuid: user.memberUuid,
          },
          orderBy: {
            createdAt: 'desc',
          },
          distinct: ['auctionId'],
        }),
      (e) => new AppException({ code: ErrorCode.DB_ERROR, message: String(e) }, HttpStatus.INTERNAL_SERVER_ERROR),
    );
  };

  findAuctionUuids = (
    auctionIds: bigint[],
  ): TE.TaskEither<AppException, { auctionUuid: string; auctionId: bigint }[]> => {
    return F.pipe(
      TE.tryCatch(
        () =>
          this.prisma.auctions.findMany({
            select: { auctionUuid: true, auctionId: true },
            where: { auctionId: { in: auctionIds } },
          }),
        (e) => new AppException({ code: ErrorCode.DB_ERROR, message: String(e) }, HttpStatus.INTERNAL_SERVER_ERROR),
      ),
    );
  };

  findAcutionsForUpdate = async (auctionUuids: string[], tx?: TX): Promise<Prisma.AuctionsGetPayload<{}>[]> => {
    const prisma = tx ?? this.prisma;
    return prisma.$queryRaw<Auctions[]>`
        SELECT *
        FROM "Auctions"
        WHERE "auctionUuid" =ANY(${auctionUuids}::uuid[])
        ORDER BY "auctionId" ASC
        FOR UPDATE
      `;
  };

  createAuctionOutbox = async (auctionids: number[], op: 'c' | 'u' | 'd', tx?: TX): Promise<void> => {
    const prisma = tx ?? this.prisma;

    const auctions = await prisma.auctions.findMany({
      where: {
        auctionId: { in: auctionids },
      },
      include: {
        auctionImages: true,
      },
    });

    for (const auction of auctions) {
      const { auctionId: _, ...auctionData } = auction;
      const auctionChangedValue: KafkaAuctionServiceOutboxTopicValue = {
        aggregateType: 'auction',
        aggregateId: auctionData.auctionUuid,
        eventType: op === 'c' ? 'AuctionCreated' : op === 'u' ? 'AuctionUpdated' : 'AuctionDeleted',
        op,
        payload: {
          ...auctionData,
          status: 'visible',
          currentBid: toNumber(auctionData.currentBid),
          minimumBid: toNumber(auctionData.minimumBid),
          viewCount: toNumber(auctionData.viewCount),
          thumbnailUrl: this.s3Service.toFullUrl(auctionData.thumbnailKey),
          images: auctionData.auctionImages.map((image) => ({
            ...image,
            auctionImageId: toNumber(image.auctionImageId),
            url: this.s3Service.toFullUrl(image.key),
          })),
        },
      };

      await prisma.outbox.create({ data: auctionChangedValue });
    }
  };
}
