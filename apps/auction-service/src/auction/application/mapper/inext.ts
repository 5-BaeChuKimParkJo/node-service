import { Provider } from '@nestjs/common';
import { AuctionMapper } from './auction.mapper';
import { AuctionAdminMapper } from './auction-admin.mapper';

export const mapperProviders: Provider[] = [AuctionMapper, AuctionAdminMapper];
