import { Module } from '@nestjs/common';
import { AuctionController } from './adapter/in/web/auction.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { auctionUseCaseProviders } from './auction-services.providers';
import { auctionPortProviders } from './auction-adapters.providers';
import { S3Module } from '@app/common/s3/s3.module';
import { mapperProviders } from './auction-mappers.providers';
import { KafkaModule } from '@app/common/kafka/kafka.module';
import { auctionMessageHandlerProviders } from './adapter/in/messaging';
import { RedisModule } from '@app/common/redis/redis.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { AuctionMediaController } from './adapter/in/web/auction-media.controller';
import { AuctionAdminController } from './adapter/in/web/auction-admin.controller';
import { InternalAdminTokenGuard } from './adapter/in/web/internal-admin-token.guard';
import { AdminHistoryController } from './adapter/in/web/admin-history.controller';
import { AdminHistoryService } from './application/service/admin-history.service';
import { AdminHistoryQueryPort } from './application/port/out/admin-history-query.port';
import { AdminHistoryPrismaAdapter } from './adapter/out/postgresql/admin-history-prisma.adapter';
import { PopularAuctionService } from './application/service/popular-auction.service';
import { PopularAuctionRepositoryPort } from './application/port/out/popular-auction-repository.port';
import { PopularAuctionCachePort } from './application/port/out/popular-auction-cache.port';
import { PopularAuctionPrismaAdapter } from './adapter/out/postgresql/popular-auction-prisma.adapter';
import { PopularAuctionRedisAdapter } from './adapter/out/redis/popular-auction-redis.adapter';
import { PopularAuctionsController } from './adapter/in/web/popular-auctions.controller';
import { PopularAuctionScheduler } from './adapter/in/scheduling/popular-auction-scheduler';

@Module({
  providers: [
    ...auctionUseCaseProviders,
    ...auctionPortProviders,
    ...mapperProviders,
    ...auctionMessageHandlerProviders,
    InternalAdminTokenGuard,
    AdminHistoryService,
    { provide: AdminHistoryQueryPort, useClass: AdminHistoryPrismaAdapter },
    PopularAuctionService,
    PopularAuctionScheduler,
    { provide: PopularAuctionRepositoryPort, useClass: PopularAuctionPrismaAdapter },
    { provide: PopularAuctionCachePort, useClass: PopularAuctionRedisAdapter },
  ],
  controllers: [
    PopularAuctionsController,
    AuctionController,
    AuctionMediaController,
    AuctionAdminController,
    AdminHistoryController,
  ],
  imports: [PrismaModule, S3Module, KafkaModule, RedisModule, TaxonomyModule],
})
export class AuctionModule {}
