import type { BidBrokerSnapshot } from '../../model/bid-processing-status.result';
export abstract class BidBrokerPort {
  abstract snapshot(): Promise<BidBrokerSnapshot>;
}
