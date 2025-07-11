import { KafkaService } from '@app/common/kafka/kafka.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Batch, Consumer, KafkaMessage } from 'kafkajs';
import { KafkaDlqTopicValue } from '@app/common/schema/kafka-dlq-topic.schema';
import { auctionServiceBidderCreatedSchema } from '../auction/adapter/in/messaging/schema/auction-bidder-created.schema';
import { AuctionServiceBidderCreatedDtoMapper } from '../auction/adapter/in/messaging/mapper/auction-service-bidder-created-dto.mapper';
import { AuctionEtcService } from './auction-etc.service';

@Injectable()
export class AuctionServiceBidderCreatedConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly auctionEtcService: AuctionEtcService,
  ) {
    this.consumer = this.kafkaService.consumer({
      groupId: 'auction-service.bidder.created',
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
          await this.auctionEtcService.bidAuctionBatch(parsed);
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
