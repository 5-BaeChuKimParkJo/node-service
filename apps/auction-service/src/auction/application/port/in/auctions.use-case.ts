import { AuctionsCommand } from '../../model/auctions.command';
import { AuctionsResult } from '../../model/auctions.result';

export abstract class AuctionsUseCase {
  abstract execute: (command: AuctionsCommand) => Promise<AuctionsResult>;
}
