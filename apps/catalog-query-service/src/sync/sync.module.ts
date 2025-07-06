import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { AuctionChangedConsumer } from './auction-changed.consumer';
import { KafkaModule } from '@app/common/kafka/kafka.module';
import { SyncFn } from './sync.fn';
import { MongoModule } from '../mongo/mongo.module';
import { SyncRepository } from './sync.repository';
import { ProductChangedConsumer } from './product-changed.consumer';

@Module({
  imports: [KafkaModule, MongoModule],
  providers: [SyncService, AuctionChangedConsumer, SyncFn, SyncRepository, ProductChangedConsumer],
})
export class SyncModule {}
