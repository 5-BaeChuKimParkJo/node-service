import { AuctionBiddersCommand } from '../../model/auction-bidders.command';
import { AuctionBiddersResult } from '../../model/auction-bidders.result';

export abstract class AuctionBiddersUseCase {
  abstract execute: (command: AuctionBiddersCommand) => Promise<AuctionBiddersResult>;
}
