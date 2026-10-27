import { Logger } from '@nestjs/common';
import type { Batch, ConsumerRunConfig, EachBatchPayload } from 'kafkajs';
import { KafkaService } from '@app/common/kafka/kafka.service';
import { AuctionEtcService } from './auction-etc.service';
import { AuctionServiceBidderCreatedConsumer } from './auction-service-bidder-created.consumer';
import { BidProcessingStateService } from '../bid-monitoring/application/service/bid-processing-state.service';

vi.mock('@app/common/kafka/kafka.service', () => ({ KafkaService: class KafkaService {} }));

const event = {
  auctionUuid: '10000000-0000-4000-8000-000000000001',
  bidderUuid: '20000000-0000-4000-8000-000000000001',
  bidAmount: 1000,
  createdAt: '2026-10-26T07:00:00.000Z',
  requestId: 'fixture-request',
};

async function harness(value = JSON.stringify(event), offset = '7') {
  const trace: string[] = [];
  let handler: NonNullable<ConsumerRunConfig['eachBatch']>;
  const consumer = {
    connect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    commitOffsets: vi.fn(async () => {
      trace.push('commit');
    }),
    run: vi.fn(async (config: ConsumerRunConfig) => {
      handler = config.eachBatch!;
    }),
  };
  const kafka = {
    consumer: vi.fn(() => consumer),
    send: vi.fn(async (_record: unknown) => {
      trace.push('dlq');
    }),
  };
  const work = {
    bidAuctionBatch: vi.fn(async (_input: unknown) => {
      trace.push('db');
    }),
  };
  const state = new BidProcessingStateService();
  const service = new AuctionServiceBidderCreatedConsumer(
    kafka as unknown as KafkaService,
    work as unknown as AuctionEtcService,
    state,
  );
  const batch = {
    topic: 'auction-service.bidder.created',
    partition: 0,
    messages: [{ offset, value: Buffer.from(value) }],
    firstOffset: () => offset,
    lastOffset: () => offset,
  } as Batch;
  const resolveOffset = vi.fn((_offset: string) => {
    trace.push('resolve');
  });
  await service.onModuleInit();
  const deliver = () => handler({ batch, resolveOffset } as unknown as EachBatchPayload);
  return { trace, consumer, kafka, work, service, state, batch, resolveOffset, deliver };
}

describe('AuctionServiceBidderCreatedConsumer recovery', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('registers manual acknowledgement and keeps the existing group and subscription', async () => {
    const h = await harness();
    expect(h.kafka.consumer).toHaveBeenCalledWith({
      groupId: 'auction-service.bidder.created',
      retry: { initialRetryTime: 1000 },
    });
    expect(h.consumer.subscribe).toHaveBeenCalledWith({ topic: h.batch.topic, fromBeginning: true });
    expect(h.consumer.run).toHaveBeenCalledWith(
      expect.objectContaining({ autoCommit: false, eachBatchAutoResolve: false }),
    );
  });

  it('processes the mapped bid before broker acknowledgement and local resolution', async () => {
    const h = await harness();
    await h.deliver();
    expect(h.work.bidAuctionBatch).toHaveBeenCalledWith([{ ...event, createdAt: new Date(event.createdAt) }]);
    expect(h.trace).toEqual(['db', 'commit', 'resolve']);
    expect(h.consumer.commitOffsets).toHaveBeenCalledWith([{ topic: h.batch.topic, partition: 0, offset: '8' }]);
    expect(h.resolveOffset).toHaveBeenCalledWith('7');
    expect(h.kafka.send).not.toHaveBeenCalled();
  });

  it.each(['not json', JSON.stringify({ ...event, bidAmount: 'invalid' })])(
    'quarantines invalid input before committing without calling the database',
    async (value) => {
      const h = await harness(value);
      await h.deliver();
      expect(h.trace).toEqual(['dlq', 'commit', 'resolve']);
      expect(h.work.bidAuctionBatch).not.toHaveBeenCalled();
    },
  );

  it('waits for a DB failure quarantine acknowledgement before committing the source range', async () => {
    const h = await harness();
    h.work.bidAuctionBatch.mockImplementation(async () => {
      h.trace.push('db');
      throw new Error('fixture DB error');
    });
    await h.deliver();
    expect(h.trace).toEqual(['db', 'dlq', 'commit', 'resolve']);
    const record = h.kafka.send.mock.calls[0][0] as { topic: string; messages: { key: string; value: string }[] };
    expect(record.topic).toBe('auction-service.bidder.created.dlq');
    expect(record.messages[0].key).toBe('auction-service.bidder.created-0-7');
    expect(JSON.parse(record.messages[0].value)).toMatchObject({
      topic: h.batch.topic,
      partition: 0,
      startOffset: '7',
      lastOffset: '7',
      error: 'Error: fixture DB error',
    });
  });

  it('leaves failed DLQ work uncommitted and unresolved for a later delivery', async () => {
    const h = await harness('not json');
    h.kafka.send.mockRejectedValueOnce(new Error('fixture producer secret'));
    const failure = await h.deliver().catch((error) => error);
    expect(failure).toMatchObject({ name: 'KafkaJSError', retriable: true });
    expect(failure.message).not.toContain('fixture producer secret');
    expect(failure.cause).toBeUndefined();
    expect(h.consumer.commitOffsets).not.toHaveBeenCalled();
    expect(h.state.snapshot()).toMatchObject({
      lastAcknowledgedAt: null,
      lastError: { code: 'DLQ_PUBLICATION_FAILED' },
    });
    expect(h.resolveOffset).not.toHaveBeenCalled();
    await h.deliver();
    expect(h.trace).toEqual(['dlq', 'commit', 'resolve']);
    expect(h.kafka.send).toHaveBeenCalledTimes(2);
  });

  it('does not advance local progress before a successful broker acknowledgement', async () => {
    const h = await harness();
    h.consumer.commitOffsets.mockImplementation(async () => {
      expect(h.resolveOffset).not.toHaveBeenCalled();
      h.trace.push('commit');
    });
    await h.deliver();
    expect(h.trace).toEqual(['db', 'commit', 'resolve']);
    expect(h.state.snapshot().lastAcknowledgedAt).not.toBeNull();
  });

  it('keeps a successful transaction out of DLQ when its offset acknowledgement fails', async () => {
    const h = await harness();
    h.consumer.commitOffsets.mockRejectedValue(new Error('fixture commit secret'));
    const failure = await h.deliver().catch((error) => error);
    expect(failure).toMatchObject({ name: 'KafkaJSError', retriable: true });
    expect(failure.message).not.toContain('fixture commit secret');
    expect(failure.cause).toBeUndefined();
    expect(h.work.bidAuctionBatch).toHaveBeenCalledTimes(1);
    expect(h.consumer.commitOffsets).toHaveBeenCalledTimes(1);
    expect(h.kafka.send).not.toHaveBeenCalled();
    expect(h.resolveOffset).not.toHaveBeenCalled();
    expect(h.state.snapshot()).toMatchObject({ lastAcknowledgedAt: null, lastError: { code: 'OFFSET_COMMIT_FAILED' } });
  });

  it('does not publish another DLQ record inside a failed quarantine commit', async () => {
    const h = await harness('not json');
    h.consumer.commitOffsets.mockRejectedValue(new Error('commit failed'));
    await expect(h.deliver()).rejects.toMatchObject({ retriable: true });
    expect(h.trace).toEqual(['dlq']);
    expect(h.kafka.send).toHaveBeenCalledTimes(1);
    expect(h.consumer.commitOffsets).toHaveBeenCalledTimes(1);
    expect(h.resolveOffset).not.toHaveBeenCalled();
  });

  it('preserves exact next offsets above the JavaScript safe-integer range', async () => {
    const h = await harness(JSON.stringify(event), '9007199254740993');
    await h.deliver();
    expect(h.consumer.commitOffsets).toHaveBeenCalledWith([
      { topic: h.batch.topic, partition: 0, offset: '9007199254740994' },
    ]);
  });

  it('disconnects its consumer during shutdown', async () => {
    const h = await harness();
    await h.service.onModuleDestroy();
    expect(h.consumer.disconnect).toHaveBeenCalledTimes(1);
  });
});
