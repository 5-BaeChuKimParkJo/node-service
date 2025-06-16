import { Provider } from '@nestjs/common';
import { AuctionBidderCreatedConsumer } from './auction-bidder-created.consumer';

export const auctionMessageHandlerProviders: Provider[] = [AuctionBidderCreatedConsumer];
