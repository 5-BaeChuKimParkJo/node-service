import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { set } from 'date-fns';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as TE from 'fp-ts/TaskEither';
import { KafkaService } from '@app/common/kafka/kafka.service';
import { BatchFn } from './batch.fn';
import { BatchRepository } from './batch.repository';

@Injectable()
export class BatchService {
  constructor(
    private readonly kafkaService: KafkaService,
    private readonly batchFn: BatchFn,
    private readonly batchRepository: BatchRepository,
  ) {}

  // @Cron('30 0 * * * *')
  @Cron('0 * * * * *')
  auctionClose() {
    console.log('[batch] auctionClose');
    F.pipe(
      set(new Date(), { minutes: 0, seconds: 0, milliseconds: 0 }),
      this.batchRepository.findClosedAuctionsAt,
      TE.map((closedAuctions) => ({ closedAuctions })),
      TE.let('noBids', ({ closedAuctions }) =>
        F.pipe(
          closedAuctions,
          A.filter((row) => row.auctionBidders.length === 0),
          A.map((row) => ({ auctionUuid: row.auctionUuid, sellerUuid: row.sellerUuid })),
        ),
      ),
      TE.let('winning', ({ closedAuctions }) =>
        F.pipe(
          closedAuctions,
          A.filter((row) => row.auctionBidders.length > 0),
          A.map((row) => ({ auctionUuid: row.auctionUuid, sellerUuid: row.sellerUuid, winner: row.auctionBidders[0] })),
        ),
      ),
      TE.let('losing', ({ closedAuctions }) =>
        F.pipe(
          closedAuctions,
          A.filter((row) => row.auctionBidders.length > 1),
          A.map((row) => ({
            auctionUuid: row.auctionUuid,
            sellerUuid: row.sellerUuid,
            losers: row.auctionBidders.slice(1),
          })),
        ),
      ),
      TE.tap(({ noBids, winning, losing }) => {
        this.batchFn.sendNoBidMessages(noBids);
        this.batchFn.sendWinningMessages(winning);
        this.batchFn.sendChatRoomCreateMessages(winning);
        this.batchFn.sendLosingMessages(losing);

        return TE.right(null);
      }),
    );

    console.log('\tend');
  }
}
