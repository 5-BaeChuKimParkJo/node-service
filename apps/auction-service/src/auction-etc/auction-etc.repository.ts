import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErrorCode, User } from '@app/common';
import * as TE from 'fp-ts/TaskEither';
import { AppException } from '@app/common/common/app.exception';
import { Prisma } from '../prisma/generated';
import * as F from 'fp-ts/function';

@Injectable()
export class AuctionEtcRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMyBids(user: User): TE.TaskEither<AppException, Prisma.AuctionBiddersGetPayload<{}>[]> {
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
  }

  findAuctionUuids(auctionIds: bigint[]): TE.TaskEither<AppException, { auctionUuid: string; auctionId: bigint }[]> {
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
  }
}
