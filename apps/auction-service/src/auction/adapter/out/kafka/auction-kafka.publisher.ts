import { KafkaService } from '@app/common/kafka/kafka.service';
import { AuctionPublisherPort } from '../../../application/port/out/auction-publisher-port';
import { PublishBidderCreatedArgs } from '../../../application/port/out/auction-publisher.port.types';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuctionKafkaPublisher extends AuctionPublisherPort {
  constructor(private readonly kafkaService: KafkaService) {
    super();
  }

  publishBidderCreated = async (event: PublishBidderCreatedArgs): Promise<void> => {
    await this.kafkaService.send({
      topic: `auction.bidder.created`,
      acks: -1,
      messages: [{ key: event.auctionUuid + Math.random(), value: JSON.stringify(event) }],
    });
  };
}
