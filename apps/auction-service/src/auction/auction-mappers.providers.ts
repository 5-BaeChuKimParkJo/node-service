import { Provider } from '@nestjs/common';
import { AuctionMapper } from './application/mapper/auction.mapper';
import { AuctionAdminMapper } from './application/mapper/auction-admin.mapper';

export const mapperProviders: Provider[] = [AuctionMapper, AuctionAdminMapper];
