import { KafkaService } from '@app/common/kafka/kafka.service';
import { Injectable } from '@nestjs/common';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';

@Injectable()
export class BatchFn {
  constructor(private readonly kafkaService: KafkaService) {}

  sendNoBidMessages = (
    noBids: {
      auctionUuid: string;
      sellerUuid: string;
    }[],
  ) => {
    if (noBids.length === 0) return;

    this.kafkaService.sendCommonMessage(
      noBids.map((row) => ({
        key: row.auctionUuid,
        value: {
          type: 'AUCTION_NO_BID',
          message: '입찰자가 없어 유찰되었습니다.',
          memberUuids: [row.sellerUuid],
          data: {
            auctionUuid: row.auctionUuid,
            sellerUuid: row.sellerUuid,
          },
        },
      })),
    );
  };

  sendWinningMessages = (
    winning: {
      auctionUuid: string;
      sellerUuid: string;
      winner: {
        bidderUuid: string;
        bidAmount: bigint;
      };
    }[],
  ) => {
    this.kafkaService.sendCommonMessage(
      winning.map((row) => ({
        key: row.auctionUuid,
        value: {
          type: 'AUCTION_WINNING',
          message: '경매에 낙찰되었습니다.',
          memberUuids: [row.winner.bidderUuid],
          data: {
            auctionUuid: row.auctionUuid,
            sellerUuid: row.sellerUuid,
          },
        },
      })),
    );
  };

  sendChatRoomCreateMessages = (
    winning: {
      auctionUuid: string;
      sellerUuid: string;
      winner: {
        bidderUuid: string;
        bidAmount: bigint;
      };
    }[],
  ) => {
    this.kafkaService.send({
      topic: 'auction-service.winning-bid',
      messages: F.pipe(
        winning,
        A.map((row) => ({
          postUuid: row.auctionUuid,
          sellerUuid: row.sellerUuid,
          buyerUuid: row.winner.bidderUuid,
          chatRoomType: 'AUCTION_PRIVATE',
        })),
        A.map((data) => ({
          key: data.postUuid,
          value: JSON.stringify(data),
        })),
      ),
    });
  };

  sendLosingMessages = (
    losing: {
      auctionUuid: string;
      sellerUuid: string;
      losers: {
        bidderUuid: string;
        bidAmount: bigint;
      }[];
    }[],
  ) => {
    this.kafkaService.sendCommonMessage(
      losing.map((row) => ({
        key: row.auctionUuid,
        value: {
          type: 'AUCTION_LOST',
          message: '최고 입찰자가 아니어서 낙찰되지 않았습니다. 해당 입찰이 유찰될 경우 참여하시겠습니까?',
          memberUuids: row.losers.map((row) => row.bidderUuid),
          data: {
            auctionUuid: row.auctionUuid,
            sellerUuid: row.sellerUuid,
          },
        },
      })),
    );
  };
}
