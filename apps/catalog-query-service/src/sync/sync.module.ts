import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { AuctionChangedConsumer } from './auction-changed.consumer';
import { KafkaModule } from '@app/common/kafka/kafka.module';

@Module({
  imports: [KafkaModule],
  providers: [SyncService, AuctionChangedConsumer],
})
export class SyncModule {}
