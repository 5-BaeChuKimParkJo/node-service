import { HttpStatus, Injectable } from '@nestjs/common';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import { SyncFn } from './sync.fn';
import { AuctionChangedValue } from '../../../../libs/common/src/schema/auction-changed.schema';
import { ErrorCode, AppException } from '@app/common';

@Injectable()
export class SyncService {
  constructor(private readonly fn: SyncFn) {}

  changeAuction = async (auctionChangedValues: AuctionChangedValue[]): Promise<void> => {
    const data = await F.pipe(
      auctionChangedValues,
      A.findFirst((o) => o.op === 'd'),
      O.match(
        () => this.fn.upsertAuction(auctionChangedValues),
        (o) => this.fn.deleteAcution(o.payload.auctionUuid),
      ),
    )();

    if (E.isLeft(data)) {
      console.error(data.left);
      throw new AppException(
        {
          code: ErrorCode.INTERNAL_VALIDATION_ERROR,
          message: data.left,
        },
        HttpStatus.NOT_FOUND,
      );
    }
  };
}
