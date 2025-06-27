import { KafkaService } from '@app/common/kafka/kafka.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer } from 'kafkajs';
import { SyncService } from './sync.service';
import { KafkaDlqTopicValue } from '@app/common/schema/kafka-dlq-topic.schema';
import { kafkaProductServiceOutboxTopicValueSchema } from '../../../../libs/common/src/schema/kafka-product-service-outbox-topic.schema';

@Injectable()
export class ProductChangedConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private retryCount: number = 0;

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly syncService: SyncService,
  ) {
    this.consumer = this.kafkaService.consumer({
      groupId: 'catalog-query-service.productchanged',
    });
  }

  onModuleInit = async () => {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: 'product-service.outbox',
      fromBeginning: true,
    });
    await this.consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      eachBatch: async ({ batch, resolveOffset }) => {
        try {
          const values = batch.messages
            .map((message) => message.value?.toString() ?? '{}')
            .map((value) => kafkaProductServiceOutboxTopicValueSchema.safeParse(JSON.parse(value)))
            .filter((safeParsed) => safeParsed.success)
            .map((safeParsed) => safeParsed.data);

          if (values.length !== 0) await this.syncService.changeProduct(values);

          resolveOffset(batch.lastOffset());
          const lastOffset = (BigInt(batch.lastOffset()) + 1n).toString();
          await this.consumer.commitOffsets([{ topic: batch.topic, partition: batch.partition, offset: lastOffset }]);
          this.retryCount = 0;
        } catch (error) {
          this.retryCount++;
          if (this.retryCount > 3) {
            await this.kafkaService.send({
              topic: 'product-service.outbox.dlq',
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
