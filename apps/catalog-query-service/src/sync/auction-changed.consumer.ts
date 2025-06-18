import { KafkaService } from '@app/common/kafka/kafka.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer } from 'kafkajs';
import { SyncService } from './sync.service';
import { outboxSchema } from './schema/outbox.schema';
import { auctionChangedValueSchema } from '@app/common';

@Injectable()
export class AuctionChangedConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private retryCount: number = 0;

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly syncService: SyncService,
  ) {
    this.consumer = this.kafkaService.consumer({
      groupId: 'catalog-query-service.auctionchanged',
    });
  }

  onModuleInit = async () => {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: 'auction-service.outbox',
      fromBeginning: true,
    });
    await this.consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      eachBatch: async ({ batch, resolveOffset }) => {
        try {
          const values = batch.messages
            .map((message) => message.value?.toString() ?? '{}')
            .map((value) => outboxSchema.safeParse(JSON.parse(value)))
            .filter((safeParsed) => safeParsed.success)
            .map((safeParsed) => safeParsed.data)
            .filter(
              (value) =>
                value.eventType === 'AuctionCreated' ||
                value.eventType === 'AuctionUpdated' ||
                value.eventType === 'AuctionDeleted',
            )
            .map((value) => auctionChangedValueSchema.parse(value));

          if (values.length !== 0) await this.syncService.changeAuction(values);

          resolveOffset(batch.lastOffset());
          const lastOffset = (BigInt(batch.lastOffset()) + 1n).toString();
          await this.consumer.commitOffsets([{ topic: batch.topic, partition: batch.partition, offset: lastOffset }]);
          this.retryCount = 0;
        } catch (error) {
          this.retryCount++;
          if (this.retryCount > 3) {
            await this.kafkaService.send({
              topic: 'auction-service.outbox.dql',
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
                  }),
                },
              ],
              acks: -1,
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
