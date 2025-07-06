import { HttpStatus, Injectable } from '@nestjs/common';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import { SyncFn } from './sync.fn';
import { ErrorCode, AppException, KafkaAuctionServiceOutboxTopicValue } from '@app/common';
import { KafkaProductServiceOutboxTopicValue } from '@app/common/schema/kafka-product-service-outbox-topic.schema';

@Injectable()
export class SyncService {
  constructor(private readonly fn: SyncFn) {}

  changeAuction = async (kafkaAuctionServiceOutboxTopicValue: KafkaAuctionServiceOutboxTopicValue[]): Promise<void> => {
    const data = await F.pipe(
      kafkaAuctionServiceOutboxTopicValue,
      A.findFirst((o) => o.op === 'd'),
      O.match(
        () => this.fn.upsertAuction(kafkaAuctionServiceOutboxTopicValue),
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

  changeProduct = async (productChangedValues: KafkaProductServiceOutboxTopicValue[]): Promise<void> => {
    const data = await F.pipe(
      productChangedValues,
      A.findFirst((o) => o.op === 'd'),
      O.match(
        () => this.fn.upsertProduct(productChangedValues),
        (o) => this.fn.deleteProduct(o.payload.id),
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
