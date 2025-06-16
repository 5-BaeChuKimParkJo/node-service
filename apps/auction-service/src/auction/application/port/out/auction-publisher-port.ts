import { PublishBidderCreatedArgs } from './auction-publisher.port.types';

export abstract class AuctionPublisherPort {
  abstract publishBidderCreated(event: PublishBidderCreatedArgs): Promise<void>;
}
