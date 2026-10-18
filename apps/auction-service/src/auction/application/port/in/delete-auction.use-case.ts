import { User } from '@app/common/types/user';
import { DeleteAuctionCommand } from '../../model/delete-auction.command';

export abstract class DeleteAuctionUseCase {
  abstract execute: (command: DeleteAuctionCommand, user: User) => Promise<void>;
}
