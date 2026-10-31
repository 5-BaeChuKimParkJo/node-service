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
import { DemoAuctionScheduler } from './adapter/in/scheduling/demo-auction-scheduler';
import { ConfigService } from '@nestjs/config';
import { DemoAuctionService } from './application/service/demo-auction.service';
import { DemoAuctionController } from './adapter/in/web/demo-auction.controller';
import { AuctionRepositoryPort } from './application/port/out/auction-repository.port';
import { CreateAuctionUseCase } from './application/port/in/create-auction.use-case';
import { SavedAuctionsController } from './adapter/in/web/saved-auctions.controller';
import { SavedAuctionService } from './application/service/saved-auction.service';
import { SavedAuctionRepositoryPort } from './application/port/out/saved-auction-repository.port';
import { SavedAuctionPrismaAdapter } from './adapter/out/postgresql/saved-auction-prisma.adapter';
import { MySalesController } from './adapter/in/web/my-sales.controller';
import { MySalesService } from './application/service/my-sales.service';
import { MySalesQueryPort } from './application/port/out/my-sales-query.port';
import { MySalesPrismaAdapter } from './adapter/out/postgresql/my-sales-prisma.adapter';
import { SellerAuctionController } from './adapter/in/web/seller-auction.controller';
import { SellerAuctionService } from './application/service/seller-auction.service';
import { SellerAuctionPort } from './application/port/out/seller-auction.port';
import { SellerAuctionPrismaAdapter } from './adapter/out/postgresql/seller-auction-prisma.adapter';

@Module({
  providers: [
    ...auctionUseCaseProviders,
    ...auctionPortProviders,
    ...mapperProviders,
    ...auctionMessageHandlerProviders,
    InternalAdminTokenGuard,
    {
      provide: DemoAuctionService,
      useFactory: (repository: AuctionRepositoryPort, creator: CreateAuctionUseCase, config: ConfigService) =>
        new DemoAuctionService(repository, creator, config.get<string>('DEMO_AUCTION_TEMPLATE_UUID', '')),
      inject: [AuctionRepositoryPort, CreateAuctionUseCase, ConfigService],
    },
    AdminHistoryService,
    SavedAuctionService,
    MySalesService,
    SellerAuctionService,
    { provide: SellerAuctionPort, useClass: SellerAuctionPrismaAdapter },
    { provide: MySalesQueryPort, useClass: MySalesPrismaAdapter },
    { provide: SavedAuctionRepositoryPort, useClass: SavedAuctionPrismaAdapter },
    { provide: AdminHistoryQueryPort, useClass: AdminHistoryPrismaAdapter },
    PopularAuctionService,
    PopularAuctionScheduler,
    DemoAuctionScheduler,
    { provide: PopularAuctionRepositoryPort, useClass: PopularAuctionPrismaAdapter },
    { provide: PopularAuctionCachePort, useClass: PopularAuctionRedisAdapter },
  ],
  controllers: [
    PopularAuctionsController,
    SavedAuctionsController,
    MySalesController,
    SellerAuctionController,
    AuctionController,
    AuctionMediaController,
    AuctionAdminController,
    DemoAuctionController,
    AdminHistoryController,
  ],
  imports: [PrismaModule, S3Module, KafkaModule, RedisModule, TaxonomyModule],
})
export class AuctionModule {}
