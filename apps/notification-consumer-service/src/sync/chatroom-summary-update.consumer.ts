import { KafkaService } from '@app/common/kafka/kafka.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer } from 'kafkajs';
import { SyncService } from './sync.service';
import { chatroomSummaryUpdateValueSchema } from './schema/chatroom-summary-update.schema';
import * as F from 'fp-ts/function';

@Injectable()
export class ChatroomSummaryUpdateConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly syncService: SyncService,
  ) {
    this.consumer = this.kafkaService.consumer({
      groupId: 'notification-consumer-service.chatroom-summary',
    });
  }

  onModuleInit = async () => {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: 'chat-service.chatroom-summary.update',
      fromBeginning: true,
    });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const { chatRoomUuid, eventType, targetMemberUuids } = F.pipe(
            message.value?.toString() ?? '{}', //
            JSON.parse,
            chatroomSummaryUpdateValueSchema.parse,
          );
          if (eventType === 'READ_UPDATE') {
            await this.syncService.chatroomSummaryReadUpdate(chatRoomUuid, targetMemberUuids);
          } else if (eventType === 'MESSAGE_UPDATE') {
            await this.syncService.chatroomSummaryMessageUpdate(chatRoomUuid, targetMemberUuids);
          }
        } catch (error) {
          console.error(error);
        }
      },
    });
  };

  onModuleDestroy = async () => {
    await this.consumer.disconnect();
  };
}
