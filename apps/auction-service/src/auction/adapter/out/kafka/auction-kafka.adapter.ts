import { KafkaService } from '@app/common/kafka/kafka.service';
import { AuctionPublisherPort } from '../../../application/port/out/auction-publisher-port';
import { PublishBidderCreatedArgs } from '../../../application/port/out/auction-publisher.port.types';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuctionKafkaAdapter extends AuctionPublisherPort {
  publishBidResults(results: Parameters<AuctionPublisherPort['publishBidResults']>[0]): void {
    this.kafkaService.sendCommonMessage(results);
  }
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
