import { CreateAuctionBidderBatchCommand } from '../dto/create-auction-bidder-batch.command';

export abstract class CreateAuctionBidderBatchUseCase {
  abstract execute: (commands: CreateAuctionBidderBatchCommand[]) => Promise<void>;
}
