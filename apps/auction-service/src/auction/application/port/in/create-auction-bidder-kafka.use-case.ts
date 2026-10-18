import { User } from '@app/common/types/user';
import { CreateAuctionBidderKafkaCommand } from '../../model/create-auction-bidder-kafka.command';

export abstract class CreateAuctionBidderKafkaUseCase {
  abstract execute: (command: CreateAuctionBidderKafkaCommand, user: User) => Promise<void>;
}
