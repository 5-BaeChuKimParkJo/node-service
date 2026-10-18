import { PublishBidderCreatedArgs } from './auction-publisher.port.types';

export abstract class AuctionPublisherPort {
  abstract publishBidderCreated(event: PublishBidderCreatedArgs): Promise<void>;
  abstract publishBidResults(
    results: Array<{
      key: string;
      value: { data: Record<string, unknown>; memberUuids: string[]; message: string; type: string };
    }>,
  ): void;
}
