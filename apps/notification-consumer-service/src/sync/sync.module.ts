import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { RedisModule } from '@app/common/redis/redis.module';
import { ChatroomSummaryUpdateConsumer } from './chatroom-summary-update.consumer';
import { KafkaModule } from '@app/common/kafka/kafka.module';

@Module({
  imports: [RedisModule, KafkaModule],
  providers: [SyncService, ChatroomSummaryUpdateConsumer],
})
export class SyncModule {}
