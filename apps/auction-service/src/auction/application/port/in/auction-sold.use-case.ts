import { User } from '@app/common/types/user';
import { AuctionSoldCommand } from '../../model/auction-sold.command';

export abstract class AuctionSoldUseCase {
  abstract execute: (command: AuctionSoldCommand, user: User) => Promise<void>;
}
