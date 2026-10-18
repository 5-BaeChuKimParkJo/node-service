import { User } from '@app/common/types/user';
import { CreateAuctionCommand } from '../../model/create-auction.command';
import { CreateAuctionResult } from '../../model/create-auction.result';

export abstract class CreateAuctionUseCase {
  abstract execute: (command: CreateAuctionCommand, user: User) => Promise<CreateAuctionResult>;
}
