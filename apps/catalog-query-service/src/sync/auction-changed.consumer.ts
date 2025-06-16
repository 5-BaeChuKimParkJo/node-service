import { KafkaService } from '@app/common/kafka/kafka.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer } from 'kafkajs';
import { SyncService } from './sync.service';
import { AuctionChangedValueSchema } from './schema/auction-changed.schema';

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
      topic: 'auction.changed',
      fromBeginning: true,
    });
    await this.consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
        try {
          const values = batch.messages
            .map((message) => message.value?.toString() ?? '{}')
            .map((value) => AuctionChangedValueSchema.safeParse(JSON.parse(value)))
            .filter((safeParsed) => safeParsed.success)
            .map((safeParsed) => safeParsed.data);

          await this.syncService.changeAuction(values);

          resolveOffset(batch.lastOffset());
          await commitOffsetsIfNecessary();
        } catch (error) {
          this.retryCount++;
          if (this.retryCount > 3) {
            console.error('3회이상 에러남ㅠ 나중에 dlq넣는걸로 수정하기');
            await this.consumer.disconnect();
          }
        }
      },
    });
  };

  onModuleDestroy = async () => {
    await this.consumer.disconnect();
  };
}
