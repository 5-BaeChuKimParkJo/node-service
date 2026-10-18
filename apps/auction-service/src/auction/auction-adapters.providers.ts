import { Provider } from '@nestjs/common';
import { AuctionRepositoryPort } from './application/port/out/auction-repository.port';
import { AuctionPrismaAdapter } from './adapter/out/postgresql/auction-prisma.adapter';
import { AuctionFileStoragePort } from './application/port/out/auction-file-storage-port';
import { AuctionImageStorageAdapter } from './adapter/out/s3/auction-image-storage.adapter';
import { AuctionPublisherPort } from './application/port/out/auction-publisher-port';
import { AuctionKafkaAdapter } from './adapter/out/kafka/auction-kafka.adapter';
import { AuctionCachePort } from './application/port/out/auction-cache.port';
import { AuctionRedisAdapter } from './adapter/out/redis/auction-redis.adapter';

export const auctionPortProviders: Provider[] = [
  {
    provide: AuctionRepositoryPort,
    useClass: AuctionPrismaAdapter,
  },
  {
    provide: AuctionFileStoragePort,
    useClass: AuctionImageStorageAdapter,
  },
  {
    provide: AuctionPublisherPort,
    useClass: AuctionKafkaAdapter,
  },
  {
    provide: AuctionCachePort,
    useClass: AuctionRedisAdapter,
  },
];
