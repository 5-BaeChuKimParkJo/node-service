import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '@app/common/common/app.exception';
import { HttpAuction, HttpAuctionSchema } from '../common/schema/http-auction.schema';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { EnvSchema } from '../common/env-schema';
import { ErrorCode } from '@app/common';
import * as TE from 'fp-ts/TaskEither';
import * as F from 'fp-ts/function';
import * as E from 'fp-ts/Either';
import { KafkaService } from '@app/common/kafka/kafka.service';
import { SendBidMessagesArgs } from './schema/send-bid-messages.schema';

@Injectable()
export class AuctionEtcFn {
  constructor(
    private readonly configService: ConfigService<EnvSchema>,
    private readonly kafkaService: KafkaService,
  ) {}

  fetchAuctions = (auctionUuids: string[]): TE.TaskEither<AppException, HttpAuction[]> => {
    return F.pipe(
      TE.tryCatch(
        () => axios.post(`${this.configService.get('CATALOG_QUERY_SERVICE')}/api/v1/auctions/bulk`, { auctionUuids }),
        (error) =>
          new AppException(
            { code: ErrorCode.OTHER_SERVICE_ERROR, message: String(error) },
            HttpStatus.INTERNAL_SERVER_ERROR,
          ),
      ),
      TE.map((res) => res.data),
      TE.flatMap((res) =>
        F.pipe(
          E.tryCatch(
            () => HttpAuctionSchema.array().parse(res),
            (error) =>
              new AppException(
                { code: ErrorCode.VALIDATION_ERROR, message: String(error) },
                HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          ),
          TE.fromEither,
        ),
      ),
    );
  };

  sendBidMessages = async (bidders: SendBidMessagesArgs[]) => {
    const messageByType = {
      'success-max': '입찰 성공',
      success: '입찰 성공',
      'rejected-period': '입찰 가능 기간이 아님',
      'rejected-amount': '해당 가격으로 입찰 할 수 없습니다.',
      'rejected-seller': '자신의 입찰',
      'rejected-duplicate': '중복 입찰',
      'rejected-too-high-bid': '너무 높은 가격입니다.',
    };

    await this.kafkaService.sendCommonMessage(
      bidders.map((bidder) => ({
        key: bidder.auctionUuid,
        value: {
          type: 'AUCTION_BID_RESULT',
          message: messageByType[bidder.type],
          memberUuids: [bidder.bidderUuid],
          data: {
            auctionUuid: bidder.auctionUuid,
            requestId: bidder.requestId,
          },
        },
      })),
    );
  };
}
