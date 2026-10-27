import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { ConfigService } from '@nestjs/config';
import { Kafka, logLevel, ConfigResourceTypes } from 'kafkajs';
import type { Admin, Consumer, KafkaMessage } from 'kafkajs';
import { PrismaClient } from '../prisma/generated';
import type { PrismaService } from '../prisma/prisma.service';
import type { KafkaService } from '@app/common/kafka/kafka.service';
import type { EnvSchema } from '@app/common/common/env-schema';
import type { S3Service } from '@app/common/s3/s3.service';
import type { TaxonomyUseCase } from '../taxonomy/application/port/in/taxonomy.use-case';
import type { AuctionEtcService } from './auction-etc.service';
import type { AuctionServiceBidderCreatedConsumer } from './auction-service-bidder-created.consumer';
import type { AuctionKafkaAdapter } from '../auction/adapter/out/kafka/auction-kafka.adapter';
import { requireTestDatabaseUrl } from '../../../../scripts/test-database.mjs';
import { requireTestKafkaBroker, requireTestKafkaCluster } from '../../../../scripts/test-kafka.mjs';
import { BidProcessingStateService } from '../bid-monitoring/application/service/bid-processing-state.service';
import { BidProcessingStatusService } from '../bid-monitoring/application/service/bid-processing-status.service';
import { KafkaBidBrokerAdapter } from '../bid-monitoring/adapter/out/kafka/kafka-bid-broker.adapter';

const broker = process.env.TEST_KAFKA_BROKER ? requireTestKafkaBroker(process.env.TEST_KAFKA_BROKER) : undefined;
const url = broker ? requireTestDatabaseUrl(process.env.TEST_DATABASE_URL) : undefined;
const inputTopic = 'auction-service.bidder.created';
const dlqTopic = `${inputTopic}.dlq`;
const resultTopic = 'notification-consumer-service.common-message';
const groupId = 'auction-service.bidder.created';
const topics = [inputTopic, dlqTopic, resultTopic];

async function until<T>(label: string, read: () => Promise<T> | T, accepts: (value: T) => boolean) {
  const deadline = Date.now() + 25000;
  let last: T;
  do {
    last = await read();
    if (accepts(last)) return last;
    await delay(100);
  } while (Date.now() < deadline);
  throw new Error(
    `${label} timed out: ${JSON.stringify(last!, (_, value) => (typeof value === 'bigint' ? String(value) : value))}`,
  );
}

async function clean(actions: (() => Promise<unknown>)[]) {
  const errors: unknown[] = [];
  for (const action of actions) {
    try {
      await action();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, 'Isolated Kafka fixture cleanup failed');
}

describe.skipIf(!broker)('bid recovery with real Kafka and PostgreSQL', () => {
  let admin: Admin;
  let database: PrismaClient;
  let wire: KafkaService;
  let publisher: AuctionKafkaAdapter;
  let business: AuctionEtcService;
  let runner: AuctionServiceBidderCreatedConsumer | undefined;
  let observer: Consumer | undefined;
  let source: Consumer | undefined;
  let ConsumerClass: typeof import('./auction-service-bidder-created.consumer').AuctionServiceBidderCreatedConsumer;
  let ServiceClass: typeof import('./auction-etc.service').AuctionEtcService;
  let RepositoryClass: typeof import('./auction-etc.repository').AuctionEtcRepository;
  let FnClass: typeof import('./auction-etc.fn').AuctionEtcFn;
  let config: ConfigService<EnvSchema>;
  let ownsTopics = false;
  let restrictedDlq = false;
  let processingState: BidProcessingStateService;
  const observerGroup = `chalnak-ci-dlq-${randomUUID()}`;
  const clients: Consumer[] = [];
  const deadLetters: KafkaMessage[] = [];
  let crashes: { restart: boolean; error: Error }[];
  let deliveries: { firstOffset: string; lastOffset: string }[];
  let fixture: { auctionUuid: string; auctionId: bigint; bidderUuid: string } | undefined;

  beforeAll(async () => {
    const kafka = new Kafka({
      clientId: 'chalnak-ci-observer',
      brokers: [broker!],
      logLevel: logLevel.NOTHING,
      requestTimeout: 5000,
      connectionTimeout: 5000,
      retry: { retries: 2, initialRetryTime: 100 },
    });
    admin = kafka.admin();
    await admin.connect();
    requireTestKafkaCluster((await admin.describeCluster()).clusterId);
    const existingTopics = await admin.listTopics();
    if (topics.some((topic) => existingTopics.includes(topic)))
      throw new Error('Application topics already exist; refusing shared broker');
    if ((await admin.listGroups()).groups.some((group) => group.groupId === groupId))
      throw new Error('Application group already exists; refusing shared broker');
    ownsTopics = await admin.createTopics({
      waitForLeaders: true,
      topics: topics.map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
        configEntries: topic === dlqTopic ? [{ name: 'max.message.bytes', value: '1048576' }] : [],
      })),
    });
    if (!ownsTopics) throw new Error('CI topics were not newly created');
    database = new PrismaClient({ datasources: { db: { url } } });
    await database.$connect();

    // Native Kafka imports run only after explicit fixture identity checks.
    const { KafkaService: KafkaClass } = await import('@app/common/kafka/kafka.service');
    ({ AuctionServiceBidderCreatedConsumer: ConsumerClass } = await import(
      './auction-service-bidder-created.consumer'
    ));
    ({ AuctionEtcService: ServiceClass } = await import('./auction-etc.service'));
    ({ AuctionEtcRepository: RepositoryClass } = await import('./auction-etc.repository'));
    ({ AuctionEtcFn: FnClass } = await import('./auction-etc.fn'));
    const { AuctionKafkaAdapter: PublisherClass } = await import('../auction/adapter/out/kafka/auction-kafka.adapter');
    config = new ConfigService<EnvSchema>({ KAFKA_SERVERS: broker });
    wire = new KafkaClass(config);
    await wire.onModuleInit();
    publisher = new PublisherClass(wire);
    const createConsumer = wire.consumer;
    wire.consumer = (options) => {
      const client = createConsumer(options);
      const currentCrashes = crashes;
      const currentDeliveries = deliveries;
      client.on(client.events.CRASH, ({ payload }) => {
        currentCrashes.push(payload);
      });
      client.on(client.events.END_BATCH_PROCESS, ({ payload }) => {
        currentDeliveries.push(payload);
      });
      clients.push(client);
      source = client;
      return client;
    };
    observer = kafka.consumer({ groupId: observerGroup });
    await observer.connect();
    await observer.subscribe({ topic: dlqTopic, fromBeginning: true });
    await observer.run({
      eachMessage: async ({ message }) => {
        deadLetters.push(message);
      },
    });
  }, 60000);

  beforeEach(async () => {
    fixture = undefined;
    processingState = new BidProcessingStateService();
    crashes = [];
    deliveries = [];
    const now = Date.now();
    const row = await database.auctions.create({
      data: {
        auctionUuid: randomUUID(),
        sellerUuid: randomUUID(),
        title: 'Real Kafka CI fixture',
        description: 'Disposable fixture',
        minimumBid: 1000n,
        currentBid: 0n,
        viewCount: 0n,
        status: 'visible',
        startAt: new Date(now - 86400000),
        endAt: new Date(now + 7 * 86400000),
        isDirectDeal: false,
        productCondition: 'used',
        thumbnailKey: 'ci-fixture',
        tagIds: [],
      },
    });
    fixture = { auctionUuid: row.auctionUuid, auctionId: row.auctionId, bidderUuid: randomUUID() };
    const storage = { toFullUrl: (key: string) => `/fixture/${key}` } as S3Service;
    const taxonomy = { resolveNames: async () => ({ categoryName: null, tagNames: [] }) } as unknown as TaxonomyUseCase;
    const repository = new RepositoryClass(database as unknown as PrismaService, storage, taxonomy);
    business = new ServiceClass(
      database as unknown as PrismaService,
      repository,
      new FnClass(config, wire),
      taxonomy,
      storage,
    );
    await startConsumer();
  }, 60000);

  async function startConsumer() {
    runner = new ConsumerClass(wire, business, processingState);
    await runner.onModuleInit();
  }

  async function setDlqLimit(value: string) {
    await admin.alterConfigs({
      validateOnly: false,
      resources: [
        {
          type: ConfigResourceTypes.TOPIC,
          name: dlqTopic,
          configEntries: [{ name: 'max.message.bytes', value }],
        },
      ],
    });
  }

  afterEach(async () => {
    const current = fixture;
    fixture = undefined;
    await clean([
      async () => {
        await runner?.onModuleDestroy();
        runner = undefined;
      },
      async () => {
        if (restrictedDlq) {
          await setDlqLimit('1048576');
          restrictedDlq = false;
        }
      },
      async () => {
        if (current)
          await database.$transaction([
            database.outbox.deleteMany({ where: { aggregateType: 'auction', aggregateId: current.auctionUuid } }),
            database.auctionBidders.deleteMany({ where: { auctionId: current.auctionId } }),
            database.auctions.deleteMany({ where: { auctionUuid: current.auctionUuid } }),
          ]);
      },
    ]);
  }, 30000);

  afterAll(async () => {
    await clean([
      ...clients.map((client) => async () => client.disconnect()),
      async () => {
        await observer?.disconnect();
      },
      async () => {
        await wire?.onModuleDestroy();
      },
      async () => {
        await database?.$disconnect();
      },
      async () => {
        if (!ownsTopics) return;
        const groups = (await admin.listGroups()).groups
          .map((group) => group.groupId)
          .filter((id) => id === groupId || id === observerGroup);
        if (groups.length) await admin.deleteGroups(groups);
        await admin.deleteTopics({ topics });
      },
      async () => {
        await admin?.disconnect();
      },
    ]);
  }, 30000);

  async function head() {
    return (await admin.fetchTopicOffsets(inputTopic)).find((partition) => partition.partition === 0)!.offset;
  }

  async function committed() {
    const offsets = await admin.fetchOffsets({ groupId, topics: [inputTopic] });
    return offsets[0].partitions.find((partition) => partition.partition === 0)!.offset;
  }

  async function progressed(offset: string) {
    await until('source committed offset', committed, (value) => value === String(BigInt(offset) + 1n));
  }

  function bid(bidderUuid = fixture!.bidderUuid) {
    return {
      auctionUuid: fixture!.auctionUuid,
      bidderUuid,
      bidAmount: 1000,
      createdAt: new Date(),
      requestId: randomUUID(),
    };
  }

  async function snapshot() {
    const row = await database.auctions.findUniqueOrThrow({ where: { auctionUuid: fixture!.auctionUuid } });
    return {
      amount: String(row.currentBid),
      bidder: row.currentBidderUuid,
      bids: await database.auctionBidders.count({ where: { auctionId: fixture!.auctionId } }),
      outbox: await database.outbox.count({ where: { aggregateType: 'auction', aggregateId: fixture!.auctionUuid } }),
    };
  }

  async function deadLetter(offset: string) {
    return until(
      'observed DLQ record',
      () =>
        deadLetters.find((message) => {
          const value = JSON.parse(message.value!.toString());
          return value.topic === inputTopic && value.partition === 0 && value.lastOffset === offset;
        }),
      Boolean,
    );
  }

  it('publishes through the native adapter and commits the persisted bid and Outbox', async () => {
    const offset = await head();
    await publisher.publishBidderCreated(bid());
    await progressed(offset);
    expect(await snapshot()).toEqual({ amount: '1000', bidder: fixture!.bidderUuid, bids: 1, outbox: 1 });
    expect(await head()).toBe(String(BigInt(offset) + 1n));
    expect(crashes).toEqual([]);
    const status = await new BidProcessingStatusService(new KafkaBidBrokerAdapter(config), processingState).get();
    expect(status).toMatchObject({ broker: 'available', groupState: 'Stable', lag: '0', retentionGap: false });
    expect(status.lastAcknowledgedAt).not.toBeNull();
  }, 60000);

  it('restarts a real consumer and redelivers an isolated rewound record without duplicating writes', async () => {
    const offset = await head();
    await publisher.publishBidderCreated(bid());
    await progressed(offset);
    const saved = await snapshot();
    expect(saved).toEqual({ amount: '1000', bidder: fixture!.bidderUuid, bids: 1, outbox: 1 });
    await until(
      'first delivery finished',
      () => deliveries.length,
      (value) => value > 0,
    );
    const firstClient = source;
    const deliveredBefore = deliveries.length;
    await runner!.onModuleDestroy();
    runner = undefined;
    await until(
      'consumer group empty',
      async () => (await admin.describeGroups([groupId])).groups[0].state,
      (state) => state === 'Empty',
    );
    await admin.setOffsets({ groupId, topic: inputTopic, partitions: [{ partition: 0, offset }] });
    expect(await committed()).toBe(offset);
    await startConsumer();
    expect(source).not.toBe(firstClient);
    await progressed(offset);
    await until(
      'actual redelivery finished',
      () => deliveries.length,
      (value) => value > deliveredBefore,
    );
    expect(await snapshot()).toEqual(saved);
  }, 60000);

  it('rolls back an actual database error, observes quarantine and advances the source offset', async () => {
    const offset = await head();
    await publisher.publishBidderCreated(bid('invalid-uuid-fixture'));
    const message = await deadLetter(offset);
    await progressed(offset);
    expect(message!.key!.toString()).toBe(`${inputTopic}-0-${offset}`);
    expect(JSON.parse(message!.value!.toString()).error).toMatch(/uuid/i);
    const status = await new BidProcessingStatusService(new KafkaBidBrokerAdapter(config), processingState).get();
    expect(status.broker).toBe('available');
    expect(BigInt(status.dlqRetained!)).toBeGreaterThan(0n);
    expect(status.lastError?.code).toBe('BID_PROCESSING_FAILED');
    expect(await snapshot()).toEqual({ amount: '0', bidder: null, bids: 0, outbox: 0 });
  }, 60000);

  it('retains source progress when the broker rejects DLQ and automatically recovers after its limit is restored', async () => {
    restrictedDlq = true;
    await setDlqLimit('128');
    const offset = await head();
    await wire.send({ topic: inputTopic, messages: [{ key: fixture!.auctionUuid, value: 'invalid-json-fixture' }] });
    const crash = await until('retriable consumer crash', () => crashes.find((event) => event.restart), Boolean);
    expect(crash!.error.message).toContain('quarantine publication failed');
    expect(BigInt(await committed())).toBeLessThanOrEqual(BigInt(offset));
    expect(await snapshot()).toEqual({ amount: '0', bidder: null, bids: 0, outbox: 0 });
    await setDlqLimit('1048576');
    restrictedDlq = false;
    await deadLetter(offset);
    await progressed(offset);
    expect(await snapshot()).toEqual({ amount: '0', bidder: null, bids: 0, outbox: 0 });
  }, 60000);
});
