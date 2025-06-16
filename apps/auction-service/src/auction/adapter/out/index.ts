import { Provider } from '@nestjs/common';
import { AuctionRepositoryPort } from '../../application/port/out/auction-repository.port';
import { AuctionPrismaRepository } from './postgresql/auction-prisma.repository';
import { AuctionFileStoragePort } from '../../application/port/out/auction-file-storage-port';
import { AuctionS3Storage } from './s3/auction-s3.storage';
import { AuctionPublisherPort } from '../../application/port/out/auction-publisher-port';
import { AuctionKafkaPublisher } from './kafka/auction-kafka.publisher';

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
];
