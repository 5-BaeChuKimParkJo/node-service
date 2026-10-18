import { ViewAuctionBatchCommand } from '../../model/view-auction-batch.command';

export abstract class AuctionViewedUseCase {
  abstract execute: (commands: ViewAuctionBatchCommand[]) => Promise<void>;
}
