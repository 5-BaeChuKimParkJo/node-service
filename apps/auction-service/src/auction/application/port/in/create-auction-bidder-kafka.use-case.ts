import { User } from '@app/common';
import { CreateAuctionBidderKafkaCommand } from '../dto/create-auction-bidder-kafka.command';

export abstract class CreateAuctionBidderKafkaUseCase {
  abstract execute: (command: CreateAuctionBidderKafkaCommand, user: User) => Promise<void>;
}
