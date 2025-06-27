import { KafkaService } from '@app/common/kafka/kafka.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { auctionServiceBidderCreatedSchema } from './schema/auction-bidder-created.schema';
import { Batch, Consumer, KafkaMessage } from 'kafkajs';
import { CreateAuctionBidderBatchUseCase } from '../../../application/port/in/create-auction-bidder-batch.use-case';
import { AuctionServiceBidderCreatedDtoMapper } from './mapper/auction-service-bidder-created-dto.mapper';
import { KafkaDlqTopicValue } from '@app/common/schema/kafka-dlq-topic.schema';

@Injectable()
export class AuctionServiceBidderCreatedConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly createAuctionBidderBatchUseCase: CreateAuctionBidderBatchUseCase,
  ) {
    this.consumer = this.kafkaService.consumer({
      groupId: 'auction-service',
    });
  }

  private parseMessages = (messages: KafkaMessage[]) => {
    return messages
      .map((message) => message.value?.toString() ?? '{}')
      .map((value) => auctionServiceBidderCreatedSchema.parse(JSON.parse(value)))
      .map((dto) => AuctionServiceBidderCreatedDtoMapper.toCommand(dto));
  };

  private commit = async (batch: Batch, resolveOffset: (offset: string) => void) => {
    resolveOffset(batch.lastOffset());
    const lastOffset = BigInt(batch.lastOffset()) + 1n;
    await this.consumer.commitOffsets([{ topic: batch.topic, partition: batch.partition, offset: String(lastOffset) }]);
  };

  private sendDlq = async (batch: Batch, error: unknown) => {
    await this.kafkaService.send({
      topic: 'auction-service.bidder.created.dlq',
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
      topic: 'auction-service.bidder.created',
      fromBeginning: true,
    });
    await this.consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      eachBatch: async ({ batch, resolveOffset }) => {
        try {
          const parsed = this.parseMessages(batch.messages);
          await this.createAuctionBidderBatchUseCase.execute(parsed);
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
