import { AuctionCommand } from '../../model/auction.command';
import { AuctionResult } from '../../model/auction.result';

export abstract class AuctionUseCase {
  abstract execute: (command: AuctionCommand) => Promise<AuctionResult>;
}
