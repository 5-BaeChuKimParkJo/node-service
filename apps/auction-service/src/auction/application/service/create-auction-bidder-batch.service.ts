import { CreateAuctionBidderBatchUseCase } from '../port/in/create-auction-bidder-batch.use-case';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import NewBidBatch from '../../domain/model/new-bid-batch';
import { CreateAuctionBidderKafkaCommand } from '../model/create-auction-bidder-kafka.command';
import { Injectable } from '@nestjs/common';
import { AuctionPublisherPort } from '../port/out/auction-publisher-port';

@Injectable()
export class CreateAuctionBidderBatchService extends CreateAuctionBidderBatchUseCase {
  constructor(
    private readonly auctionRepositoryPort: AuctionRepositoryPort,
    private readonly publisher: AuctionPublisherPort,
  ) {
    super();
  }

  override execute = async (commands: CreateAuctionBidderKafkaCommand[]) => {
    if (commands.length === 0) {
      return;
    }
    const auctionUuid = commands[0].auctionUuid;
    await this.auctionRepositoryPort.withLockedAuction(auctionUuid, async (session) => {
      const auction = session.auction;
      const snapshot = auction.getSnapshot();
      const auctionBidderForCreateBatchDomain = new NewBidBatch({
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
      const awardedBidderUuids = auctionBidderForCreateBatchDomain.getSnapshot().map(({ bidderUuid }) => bidderUuid);

      if (currentBidder) {
        await session.createBids(auctionBidderForCreateBatchDomain);
        await session.updateCurrent(currentBidder.bidAmount, currentBidder.bidderUuid);

        this.publisher.publishBidResults(
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
      }

      const bidderUuids = commands.map(({ bidderUuid }) => bidderUuid);
      const awardedBidderUuidsSet = new Set(awardedBidderUuids);
      const rejectedBidderUuids = bidderUuids.filter((bidderUuid) => !awardedBidderUuidsSet.has(bidderUuid));
      this.publisher.publishBidResults(
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
    });
  };
}
