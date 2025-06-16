import { Injectable } from '@nestjs/common';
import { User } from '@app/common';
import { AuctionPublisherPort } from '../port/out/auction-publisher-port';
import { CreateAuctionBidderKafkaCommand } from '../port/dto/create-auction-bidder-kafka.command';
import { CreateAuctionBidderKafkaUseCase } from '../port/in/create-auction-bidder-kafka.use-case';

@Injectable()
export class CreateAuctionBidderKafkaService extends CreateAuctionBidderKafkaUseCase {
  constructor(private readonly auctionBidderEventPort: AuctionPublisherPort) {
    super();
  }

  override execute = async (command: CreateAuctionBidderKafkaCommand, user: User): Promise<void> => {
    await this.auctionBidderEventPort.publishBidderCreated(command);
  };
}
