import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { RedisModule } from '@app/common/redis/redis.module';
import { ChatroomSummaryUpdateConsumer } from './chatroom-summary-update.consumer';
import { KafkaModule } from '@app/common/kafka/kafka.module';
import { CommonMessageConsumer } from './common-message.consumer';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [RedisModule, KafkaModule, NotificationModule],
  providers: [SyncService, ChatroomSummaryUpdateConsumer, CommonMessageConsumer],
})
export class SyncModule {}
