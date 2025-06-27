import { Provider } from '@nestjs/common';
import { AuctionRepositoryPort } from '../../application/port/out/auction-repository.port';
import { AuctionPrismaRepository } from './postgresql/auction-prisma.repository';
import { AuctionFileStoragePort } from '../../application/port/out/auction-file-storage-port';
import { AuctionS3Storage } from './s3/auction-s3.storage';
import { AuctionPublisherPort } from '../../application/port/out/auction-publisher-port';
import { AuctionKafkaPublisher } from './kafka/auction-kafka.publisher';
import { AuctionCachePort } from '../../application/port/out/auction-cache.port';
import { AuctionRedisCache } from './redis/auction-redis.cache';

export const auctionPortProviders: Provider[] = [
  {
    provide: AuctionRepositoryPort,
    useClass: AuctionPrismaRepository,
  },
  {
    provide: AuctionFileStoragePort,
    useClass: AuctionS3Storage,
  },
  {
    provide: AuctionPublisherPort,
    useClass: AuctionKafkaPublisher,
  },
  {
    provide: AuctionCachePort,
    useClass: AuctionRedisCache,
  },
];
