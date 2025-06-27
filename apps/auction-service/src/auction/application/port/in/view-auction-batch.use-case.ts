import { ViewAuctionBatchCommand } from '../dto/view-auction-batch.command';

export abstract class AuctionViewedUseCase {
  abstract execute: (commands: ViewAuctionBatchCommand[]) => Promise<void>;
}
