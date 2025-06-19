import { HttpStatus, Injectable } from '@nestjs/common';
import { ReadRepository } from './read.repository';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as NEA from 'fp-ts/NonEmptyArray';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import { ReadFn } from './read.fn';
import { AppException, ErrorCode } from '@app/common';
import * as Str from 'fp-ts/string';
import { Auction } from './schema/auction.schema';

@Injectable()
export class ReadService {
  constructor(
    private readonly readRepository: ReadRepository,
    private readonly fn: ReadFn,
  ) {}

  auctions = (auctionUuids: string[]): TE.TaskEither<AppException, Auction[]> => {
    return F.pipe(
      this.readRepository.findAuction(auctionUuids),
      TE.flatMap((auctions) =>
        F.pipe(
          TE.Do,
          TE.let('auctions', () => auctions),
          TE.bind('sellerByUuid', ({ auctions }) =>
            F.pipe(
              auctions,
              A.map((auction) => auction.sellerUuid),
              A.uniq(Str.Eq),
              this.fn.fetchMembers,
              TE.map(NEA.groupBy(({ memberUuid }) => memberUuid)),
            ),
          ),
        ),
      ),
      TE.map(({ auctions, sellerByUuid }) =>
        F.pipe(
          auctions,
          A.map((auction) => ({ ...auction, seller: A.head(sellerByUuid[auction.sellerUuid]) })),
          A.filterMap((auction) =>
            O.isNone(auction.seller) ? O.none : O.some({ ...auction, seller: auction.seller.value }),
          ),
        ),
      ),
    );
  };

  auction = (auctionUuid: string): TE.TaskEither<AppException, Auction> => {
    return F.pipe(
      this.auctions([auctionUuid]),
      TE.map(A.head),
      TE.flatMap(
        TE.fromOption(
          () =>
            new AppException(
              { code: ErrorCode.NOT_FOUND, message: '해당 경매를 찾을 수 없습니다.' },
              HttpStatus.NOT_FOUND,
            ),
        ),
      ),
    );
  };
}
