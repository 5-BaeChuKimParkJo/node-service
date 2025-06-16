import { Injectable } from '@nestjs/common';
import { Auction, AuctionChangedValue } from './schema/auction-changed.schema';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as NEA from 'fp-ts/NonEmptyArray';
import * as Ord from 'fp-ts/Ord';
import * as Num from 'fp-ts/number';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as Rec from 'fp-ts/Record';
import { U } from '@app/common/utils/fp-ts';

@Injectable()
export class SyncService {
  changeAuction = async (auctionChangeds: AuctionChangedValue[]) => {
    const aaa = F.pipe(
      auctionChangeds,
      A.map((o) => o.after),
      A.filter((o) => o !== null),
      NEA.fromArray,
      O.map(NEA.max(U.Rec.ordBy('version', Num.Ord))),
      TE.fromOption(() => 'no auction'),
      TE.flatMap((auction) =>
        F.pipe(
          TE.Do,
          TE.let('auction', () => auction),
        ),
      ),
    );
  };
}
