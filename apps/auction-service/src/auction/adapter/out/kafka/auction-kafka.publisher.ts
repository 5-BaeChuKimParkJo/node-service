import { KafkaService } from '@app/common/kafka/kafka.service';
import { AuctionPublisherPort } from '../../../application/port/out/auction-publisher-port';
import { PublishBidderCreatedArgs } from '../../../application/port/out/auction-publisher.port.types';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuctionKafkaPublisher extends AuctionPublisherPort {
  constructor(private readonly kafkaService: KafkaService) {
    super();
  }

  publishBidderCreated = async (args: PublishBidderCreatedArgs): Promise<void> => {
    await this.kafkaService.send({
      topic: 'auction-service.bidder.created',
      messages: [{ key: args.auctionUuid, value: JSON.stringify(args) }],
      bulk: true,
    });
  };
}
