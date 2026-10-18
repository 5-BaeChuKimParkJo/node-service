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

@Module({
  providers: [
    ...auctionUseCaseProviders,
    ...auctionPortProviders,
    ...mapperProviders,
    ...auctionMessageHandlerProviders,
    InternalAdminTokenGuard,
  ],
  controllers: [AuctionController, AuctionMediaController, AuctionAdminController],
  imports: [PrismaModule, S3Module, KafkaModule, RedisModule, TaxonomyModule],
})
export class AuctionModule {}
