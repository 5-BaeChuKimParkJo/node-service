import { KafkaService } from '@app/common/kafka/kafka.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Batch, Consumer, KafkaMessage } from 'kafkajs';
import { CreateAuctionBidderBatchUseCase } from '../../../application/port/in/create-auction-bidder-batch.use-case';
import { KafkaDlqTopicValue } from '@app/common/schema/kafka-dlq-topic.schema';
import { kafkaAuctionViewedTopicValueSchema } from '@app/common/schema/kafka-acution-viewed-topic.schema';
import { AuctionViewedUseCase } from '../../../application/port/in/view-auction-batch.use-case';

@Injectable()
export class CatalogQueryServiceAuctionViewedConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly auctionViewedUseCase: AuctionViewedUseCase,
  ) {
    this.consumer = this.kafkaService.consumer({
      groupId: 'auction-service.auction.viewed',
    });
  }

  private parseMessages = (messages: KafkaMessage[]) => {
    return messages
      .map((message) => ({ value: message.value?.toString() ?? '{}', viewedAt: new Date(Number(message.timestamp)) }))
      .map(({ value, viewedAt }) => ({ ...kafkaAuctionViewedTopicValueSchema.parse(JSON.parse(value)), viewedAt }));
  };

  private commit = async (batch: Batch, resolveOffset: (offset: string) => void) => {
    resolveOffset(batch.lastOffset());
    const lastOffset = BigInt(batch.lastOffset()) + 1n;
    await this.consumer.commitOffsets([{ topic: batch.topic, partition: batch.partition, offset: String(lastOffset) }]);
  };

  private sendDlq = async (batch: Batch, error: unknown) => {
    await this.kafkaService.send({
      topic: 'catalog-query-service.auction.viewed.dlq',
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
  };

  onModuleInit = async () => {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: 'catalog-query-service.auction.viewed',
      fromBeginning: true,
    });
    await this.consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      eachBatch: async ({ batch, resolveOffset }) => {
        try {
          const parsed = this.parseMessages(batch.messages);
          await this.auctionViewedUseCase.execute(parsed);
          await this.commit(batch, resolveOffset);
        } catch (error) {
          await this.commit(batch, resolveOffset);
          await this.sendDlq(batch, error);
          console.log(error);
        }
      },
    });
  };

  onModuleDestroy = async () => {
    await this.consumer.disconnect();
  };
}
