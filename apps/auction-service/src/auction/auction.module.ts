import { Module } from '@nestjs/common';
import { AuctionController } from './adapter/in/web/auction.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { auctionUseCaseProviders } from './application/use-case';
import { auctionPortProviders } from './adapter/out';
import { S3Module } from '@app/common/s3/s3.module';
import { mapperProviders } from './application/mapper/inext';
import { KafkaModule } from '@app/common/kafka/kafka.module';
import { auctionMessageHandlerProviders } from './adapter/in/messaging';
import { RedisModule } from '@app/common/redis/redis.module';

@Module({
  providers: [
    ...auctionUseCaseProviders,
    ...auctionPortProviders,
    ...mapperProviders,
    ...auctionMessageHandlerProviders,
  ],
  controllers: [AuctionController],
  imports: [PrismaModule, S3Module, KafkaModule, RedisModule],
})
export class AuctionModule {}
