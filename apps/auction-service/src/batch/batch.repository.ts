import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as TE from 'fp-ts/TaskEither';
import { Prisma } from '../prisma/generated';

@Injectable()
export class BatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  findClosedAuctionsAt(endAt: Date): TE.TaskEither<
    string,
    Prisma.AuctionsGetPayload<{
      select: {
        auctionUuid: true;
        sellerUuid: true;
        auctionBidders: { select: { bidderUuid: true; bidAmount: true } };
      };
    }>[]
  > {
    return TE.tryCatch(
      () =>
        this.prisma.auctions.findMany({
          where: { endAt },
          select: {
            auctionUuid: true,
            sellerUuid: true,
            auctionBidders: {
              orderBy: { bidAmount: 'desc' },
              select: { bidderUuid: true, bidAmount: true },
            },
          },
        }),
      (error) => (error instanceof Error ? error.message : 'unknown error'),
    );
  }
}
