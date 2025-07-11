import { Provider } from '@nestjs/common';
import { CatalogQueryServiceAuctionViewedConsumer } from './catalog-query-service-auction-viewed.consumer';

export const auctionMessageHandlerProviders: Provider[] = [CatalogQueryServiceAuctionViewedConsumer];
