import { CreateAuctionBidderBatchUseCase } from '../port/in/create-auction-bidder-batch.use-case';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import AuctionBidderForCreateBulkDomain from '../../domain/model/auction-bidder-for-create-bulk.domain';
import { CreateAuctionBidderKafkaCommand } from '../port/dto/create-auction-bidder-kafka.command';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CreateAuctionBidderBatchService extends CreateAuctionBidderBatchUseCase {
  constructor(private readonly auctionRepositoryPort: AuctionRepositoryPort) {
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
      }
    });
  };
}
