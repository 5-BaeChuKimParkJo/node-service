import { Provider } from '@nestjs/common';
import { AuctionServiceBidderCreatedConsumer } from './auction-service-bidder-created.consumer';
import { CatalogQueryServiceAuctionViewedConsumer } from './catalog-query-service-auction-viewed.consumer';

export const auctionMessageHandlerProviders: Provider[] = [
  AuctionServiceBidderCreatedConsumer,
  CatalogQueryServiceAuctionViewedConsumer,
];
