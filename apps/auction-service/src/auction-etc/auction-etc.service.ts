import { HttpStatus, Injectable } from '@nestjs/common';
import { AuctionEtcRepository } from './auction-etc.repository';
import { MyBidsResponseDto } from './dto/my-bids.dto';
import { ErrorCode, U, User } from '@app/common';
import { AppException } from '@app/common/common/app.exception';
import * as TE from 'fp-ts/TaskEither';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as NEA from 'fp-ts/NonEmptyArray';
import * as Rec from 'fp-ts/Record';
import { AuctionEtcFn } from './auction-etc.fn';
import { MyBidsOutput } from './schema/my-bids.schema';

@Injectable()
export class AuctionEtcService {
  constructor(
    private readonly auctionEtcRepository: AuctionEtcRepository,
    private readonly auctionEtcFn: AuctionEtcFn,
  ) {}

  getMyBids = (user: User): TE.TaskEither<AppException, MyBidsOutput[]> => {
    return F.pipe(
      TE.Do,
      TE.bind('bids', () => this.auctionEtcRepository.findMyBids(user)),
      TE.map((d) => {
        console.log(1);
        return d;
      }),
      TE.bind('uuidById', ({ bids }) =>
        F.pipe(
          bids,
          A.map((auction) => auction.auctionId),
          (auctionIds) => this.auctionEtcRepository.findAuctionUuids(auctionIds),
          TE.map(NEA.groupBy((row) => String(row.auctionId))),
          TE.map(Rec.map(NEA.head)),
          TE.map(Rec.map((auction) => auction.auctionUuid)),
        ),
      ),
      TE.map((d) => {
        console.log(2);
        return d;
      }),
      TE.bind('auctionByUuid', ({ uuidById }) =>
        F.pipe(
          uuidById,
          U.Rec.values,
          this.auctionEtcFn.fetchAuctions,
          TE.map(NEA.groupBy((auction) => auction.auctionUuid)),
          TE.map(Rec.map(NEA.head)),
        ),
      ),
      TE.map((d) => {
        console.log(3);
        return d;
      }),
      TE.map(({ bids, auctionByUuid, uuidById }) =>
        bids.map((bid) => ({
          bidder: bid,
          auction: auctionByUuid[uuidById[String(bid.auctionId)]],
        })),
      ),
    );
  };
}
