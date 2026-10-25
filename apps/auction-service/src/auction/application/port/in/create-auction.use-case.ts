import { User } from '@app/common/types/user';
import { CreateAuctionCommand } from '../../model/create-auction.command';
import { CreateAuctionResult } from '../../model/create-auction.result';
import { DemoAuctionCreationCommand } from '../../model/demo-auction-creation.command';
import { DemoAuctionCreationResult } from '../../model/demo-auction-creation.result';

export abstract class CreateAuctionUseCase {
  abstract execute: (command: CreateAuctionCommand, user: User) => Promise<CreateAuctionResult>;
  abstract executeDemo: (
    command: CreateAuctionCommand,
    user: User,
    context: DemoAuctionCreationCommand,
  ) => Promise<DemoAuctionCreationResult>;
}
