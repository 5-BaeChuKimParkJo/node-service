import { KafkaService } from '@app/common/kafka/kafka.service';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Batch, Consumer, KafkaJSError, KafkaMessage } from 'kafkajs';
import { KafkaDlqTopicValue } from '@app/common/schema/kafka-dlq-topic.schema';
import { auctionServiceBidderCreatedSchema } from '../auction/adapter/in/messaging/schema/auction-bidder-created.schema';
import { AuctionBidCreatedEventMapper } from '../auction/adapter/in/messaging/mapper/auction-bid-created-event.mapper';
import { AuctionEtcService } from './auction-etc.service';
import { BidProcessingStateService } from '../bid-monitoring/application/service/bid-processing-state.service';
import type { BidErrorCode, BidFailureContext } from '../bid-monitoring/application/model/bid-processing-status.result';

@Injectable()
export class AuctionServiceBidderCreatedConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private readonly logger = new Logger(AuctionServiceBidderCreatedConsumer.name);

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly auctionEtcService: AuctionEtcService,
    private readonly processingState: BidProcessingStateService,
  ) {
    this.consumer = this.kafkaService.consumer({
      groupId: 'auction-service.bidder.created',
      retry: { initialRetryTime: 1000 },
    });
  }

  private parseMessages = (messages: KafkaMessage[]) => {
    return messages
      .map((message) => message.value?.toString() ?? '{}')
      .map((value) => auctionServiceBidderCreatedSchema.parse(JSON.parse(value)))
      .map((dto) => AuctionBidCreatedEventMapper.toCommand(dto));
  };

  private observeFailure(code: BidErrorCode, batch: Batch): void {
    let context: BidFailureContext | undefined;
    try {
      const firstOffset = batch.firstOffset();
      if (firstOffset !== null)
        context = {
          topic: batch.topic,
          partition: batch.partition,
          firstOffset,
          lastOffset: batch.lastOffset(),
        };
    } catch {
      /* Optional telemetry must not interrupt recovery. */
    }
    this.processingState.recordError(code, context);
  }

  private commit = async (batch: Batch, resolveOffset: (offset: string) => void) => {
    const lastOffset = BigInt(batch.lastOffset()) + 1n;
    try {
      await this.consumer.commitOffsets([
        { topic: batch.topic, partition: batch.partition, offset: String(lastOffset) },
      ]);
    } catch {
      this.observeFailure('OFFSET_COMMIT_FAILED', batch);
      this.logger.error(`Bid offset acknowledgement failed: ${batch.topic}/${batch.partition}/${batch.lastOffset()}`);
      throw new KafkaJSError('Bid offset acknowledgement failed; restart from broker offsets', { retriable: true });
    }
    resolveOffset(batch.lastOffset());
    this.processingState.recordAcknowledgement();
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
        } catch (error) {
          this.observeFailure('BID_PROCESSING_FAILED', batch);
          try {
            await this.sendDlq(batch, error);
          } catch {
            this.observeFailure('DLQ_PUBLICATION_FAILED', batch);
            this.logger.error(
              `Bid quarantine publication failed: ${batch.topic}/${batch.partition}/${batch.lastOffset()}`,
            );
            throw new KafkaJSError('Bid quarantine publication failed; source offsets retained', { retriable: true });
          }
          this.logger.warn(
            `Bid batch quarantined: ${batch.topic}/${batch.partition}/${batch.firstOffset()}-${batch.lastOffset()}`,
          );
        }
        await this.commit(batch, resolveOffset);
      },
    });
  };

  onModuleDestroy = async () => {
    await this.consumer.disconnect();
  };
}
