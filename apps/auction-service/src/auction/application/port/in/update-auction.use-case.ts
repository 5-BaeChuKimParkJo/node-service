import { User } from '@app/common/types/user';
import { UpdateAuctionCommand } from '../../model/update-auction.command';
import { UpdateAuctionResult } from '../../model/update-auction.result';

export abstract class UpdateAuctionUseCase {
  abstract execute: (command: UpdateAuctionCommand, user: User) => Promise<UpdateAuctionResult>;
}
