import { AuctionsByIdsCommand } from '../../model/auctions-by-ids.command';
import { AuctionsByIdsResult } from '../../model/auctions-by-ids.result';

export abstract class AuctionsByIdsUseCase {
  abstract execute: (command: AuctionsByIdsCommand) => Promise<AuctionsByIdsResult>;
}
