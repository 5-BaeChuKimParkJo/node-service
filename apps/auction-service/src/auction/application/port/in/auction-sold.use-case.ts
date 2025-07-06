import { User } from '@app/common';
import { AuctionSoldCommand } from '../dto/auction-sold.command';

export abstract class AuctionSoldUseCase {
  abstract execute: (command: AuctionSoldCommand, user: User) => Promise<void>;
}
