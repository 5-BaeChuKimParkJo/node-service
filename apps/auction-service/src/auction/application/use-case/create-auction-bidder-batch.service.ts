import { CreateAuctionBidderBatchUseCase } from '../port/in/create-auction-bidder-batch.use-case';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import AuctionBidderForCreateBulkDomain from '../../domain/model/auction-bidder-for-create-bulk.domain';
import { CreateAuctionBidderKafkaCommand } from '../port/dto/create-auction-bidder-kafka.command';
import { Injectable } from '@nestjs/common';
import { KafkaService } from '@app/common/kafka/kafka.service';

@Injectable()
export class CreateAuctionBidderBatchService extends CreateAuctionBidderBatchUseCase {
  constructor(
    private readonly auctionRepositoryPort: AuctionRepositoryPort,
    private readonly kafkaService: KafkaService,
  ) {
    super();
  }

  override execute = async (commands: CreateAuctionBidderKafkaCommand[]) => {
    if (commands.length === 0) {
      return;
    }
    await this.auctionRepositoryPort.transaction(async (tx) => {
      const auctionUuid = commands[0].auctionUuid;
      const auction = await this.auctionRepositoryPort.findAcutionForUpdate(auctionUuid, tx);
      const snapshot = auction.getSnapshot();
      const auctionBidderForCreateBatchDomain = new AuctionBidderForCreateBulkDomain({
        bidders: commands.map((bidder) => ({
          auctionUuid: snapshot.auctionUuid,
          auctionId: snapshot.auctionId,
          currentBid: snapshot.currentBid,
          bidAmount: BigInt(bidder.bidAmount),
          bidderUuid: bidder.bidderUuid,
          createdAt: bidder.createdAt,
        })),
        auction,
      });
      const currentBidder = auctionBidderForCreateBatchDomain.getCurrent();

      if (currentBidder) {
        await this.auctionRepositoryPort.createAuctionBidders(auctionBidderForCreateBatchDomain, tx);
        await this.auctionRepositoryPort.updateAuctionCurrent(
          auctionUuid,
          currentBidder.bidAmount,
          currentBidder.bidderUuid,
          tx,
        );

        const bidderUuids = commands.map(({ bidderUuid }) => bidderUuid);
        const awardedBidderUuids = auctionBidderForCreateBatchDomain.getSnapshot().map(({ bidderUuid }) => bidderUuid);
        const awardedBidderUuidsSet = new Set(bidderUuids);
        const rejectedBidderUuids = bidderUuids.filter((bidderUuid) => !awardedBidderUuidsSet.has(bidderUuid));

        this.kafkaService.sendCommonMessage(
          awardedBidderUuids.map((bidderUuid) => ({
            key: bidderUuid,
            value: {
              data: {},
              memberUuids: [bidderUuid],
              message: 'auction-bidder-awarded',
              type: 'auction-bidder-awarded',
            },
          })),
        );
        this.kafkaService.sendCommonMessage(
          rejectedBidderUuids.map((bidderUuid) => ({
            key: bidderUuid,
            value: {
              data: {},
              memberUuids: [bidderUuid],
              message: 'auction-bidder-rejected',
              type: 'auction-bidder-rejected',
            },
          })),
        );
      }
    });
  };
}
