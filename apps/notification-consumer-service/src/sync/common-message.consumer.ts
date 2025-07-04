import { KafkaService } from '@app/common/kafka/kafka.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer } from 'kafkajs';
import { SyncService } from './sync.service';
import { KafkaDlqTopicValue } from '@app/common/schema/kafka-dlq-topic.schema';
import { commonMessageValueSchema } from './schema/common-message.schema';

@Injectable()
export class CommonMessageConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private retryCount: number = 0;

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly syncService: SyncService,
  ) {
    this.consumer = this.kafkaService.consumer({
      groupId: 'notification-consumer-service.common-message-consumer',
    });
  }

  onModuleInit = async () => {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: 'notification-consumer-service.common-message',
      fromBeginning: true,
    });
    await this.consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      eachBatch: async ({ batch, resolveOffset }) => {
        try {
          const values = batch.messages
            .map((message) => message.value?.toString() ?? '{}')
            .map((value) => commonMessageValueSchema.safeParse(JSON.parse(value)))
            .filter((safeParsed) => safeParsed.success)
            .map((safeParsed) => safeParsed.data);

          if (values.length !== 0) {
            await this.syncService.createNotification(values);
            await this.syncService.sendCommonMessage(values);
          }

          resolveOffset(batch.lastOffset());
          const lastOffset = (BigInt(batch.lastOffset()) + 1n).toString();
          await this.consumer.commitOffsets([{ topic: batch.topic, partition: batch.partition, offset: lastOffset }]);
          this.retryCount = 0;
        } catch (error) {
          this.retryCount++;
          if (this.retryCount > 3) {
            await this.kafkaService.send({
              topic: 'notification-consumer-service.common-message.dlq',
              messages: [
                {
                  key: `${batch.topic}-${batch.partition}-${batch.lastOffset()}`,
                  value: JSON.stringify({
                    startOffset: batch.firstOffset(),
                    lastOffset: batch.lastOffset(),
                    partition: batch.partition,
                    topic: batch.topic,
                    error: String(error),
                    timestamp: new Date(),
                  } satisfies KafkaDlqTopicValue),
                },
              ],
            });
            console.error('3회이상 에러남ㅠ', error);

            resolveOffset(batch.lastOffset());
            const lastOffset = (BigInt(batch.lastOffset()) + 1n).toString();
            await this.consumer.commitOffsets([{ topic: batch.topic, partition: batch.partition, offset: lastOffset }]);
          }
        }
      },
    });
  };

  onModuleDestroy = async () => {
    await this.consumer.disconnect();
  };
}
