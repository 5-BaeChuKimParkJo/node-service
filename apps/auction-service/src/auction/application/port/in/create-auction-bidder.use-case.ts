import { User } from '@app/common/types/user';
import { CreateAuctionBidderCommand } from '../../model/create-auction-bidder.command';

export abstract class CreateAuctionBidderUseCase {
  abstract execute: (command: CreateAuctionBidderCommand, user: User) => Promise<void>;
}
