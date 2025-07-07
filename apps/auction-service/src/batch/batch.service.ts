import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { set } from 'date-fns';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import { KafkaService } from '@app/common/kafka/kafka.service';

@Injectable()
export class BatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaService: KafkaService,
  ) {}

  // @Cron('30 0 * * * *')
  @Cron('0 * * * * *')
  async auctionClose() {
    console.log('[batch] auctionClose');
    const endAt = set(new Date(), { minutes: 0, seconds: 0, milliseconds: 0 });
    console.log(`\tendAt: ${endAt.toISOString()}`);

    const auctions = await this.prisma.auctions.findMany({
      where: { endAt },
      select: {
        auctionUuid: true,
        sellerUuid: true,
        auctionBidders: {
          orderBy: { bidAmount: 'desc' },
          select: { bidderUuid: true, bidAmount: true },
        },
      },
    });

    const noBids = F.pipe(
      auctions,
      A.filter((row) => row.auctionBidders.length === 0),
    );

    if (noBids.length > 0) {
      await this.kafkaService.sendCommonMessage(
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
    }

    const winning = F.pipe(
      auctions,
      A.filter((row) => row.auctionBidders.length > 0),
    );

    if (winning.length > 0) {
      await this.kafkaService.send({
        topic: 'auction-service.winning-bid',
        messages: F.pipe(
          winning,
          A.map((row) => ({
            postUuid: row.auctionUuid,
            sellerUuid: row.sellerUuid,
            buyerUuid: row.auctionBidders[0].bidderUuid,
            chatRoomType: 'AUCTION_PRIVATE',
          })),
          A.map((data) => ({
            key: data.postUuid,
            value: JSON.stringify(data),
          })),
        ),
      });

      await this.kafkaService.sendCommonMessage(
        winning.map((row) => ({
          key: row.auctionUuid,
          value: {
            type: 'AUCTION_WINNING',
            message: '경매에 낙찰되었습니다.',
            memberUuids: [row.sellerUuid],
            data: {
              auctionUuid: row.auctionUuid,
              sellerUuid: row.sellerUuid,
            },
          },
        })),
      );
    }

    const losing = F.pipe(
      auctions,
      A.filter((row) => row.auctionBidders.length > 1),
      A.map((row) => ({ ...row, auctionBidders: row.auctionBidders.slice(1) })),
    );

    if (losing.length > 0) {
      await this.kafkaService.sendCommonMessage(
        losing.map((row) => ({
          key: row.auctionUuid,
          value: {
            type: 'AUCTION_LOST',
            message: '최고 입찰자가 아니어서 낙찰되지 않았습니다. 해당 입찰이 유찰될 경우 참여하시겠습니까?',
            memberUuids: row.auctionBidders.map((row) => row.bidderUuid),
            data: {
              auctionUuid: row.auctionUuid,
              sellerUuid: row.sellerUuid,
            },
          },
        })),
      );
    }

    console.log('\tend');
  }
}
