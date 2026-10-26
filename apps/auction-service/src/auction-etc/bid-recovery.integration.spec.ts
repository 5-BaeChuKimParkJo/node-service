import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { Batch, ConsumerRunConfig, EachBatchPayload } from 'kafkajs';
import { PrismaClient } from '../prisma/generated';
import type { PrismaService } from '../prisma/prisma.service';
import type { S3Service } from '@app/common/s3/s3.service';
import type { TaxonomyUseCase } from '../taxonomy/application/port/in/taxonomy.use-case';
import type { KafkaService } from '@app/common/kafka/kafka.service';
import type { AuctionEtcFn } from './auction-etc.fn';
import { AuctionEtcRepository } from './auction-etc.repository';
import { AuctionEtcService } from './auction-etc.service';
import { AuctionServiceBidderCreatedConsumer } from './auction-service-bidder-created.consumer';
import { requireTestDatabaseUrl } from '../../../../scripts/test-database.mjs';

vi.mock('@app/common/kafka/kafka.service', () => ({ KafkaService: class KafkaService {} }));

const url = process.env.TEST_DATABASE_URL ? requireTestDatabaseUrl(process.env.TEST_DATABASE_URL) : undefined;

describe.skipIf(!url)('bid recovery on isolated PostgreSQL', () => {
  let database: PrismaClient;
  let repository: AuctionEtcRepository;
  let service: AuctionEtcService;
  let auctionUuid: string;
  let auctionId: bigint;
  let bidderUuid: string;
  let input: { auctionUuid: string; bidderUuid: string; bidAmount: number; createdAt: Date; requestId: string }[];
  const notifications = { sendBidMessages: vi.fn() };

  beforeAll(async () => {
    database = new PrismaClient({ datasources: { db: { url } } });
    await database.$connect();
  });

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    notifications.sendBidMessages.mockReset().mockResolvedValue(undefined);
    auctionUuid = randomUUID();
    bidderUuid = randomUUID();
    const now = new Date();
    const row = await database.auctions.create({
      data: {
        auctionUuid,
        sellerUuid: randomUUID(),
        title: 'Isolated bid recovery fixture',
        description: 'Fixture only',
        minimumBid: 1000n,
        currentBid: 0n,
        viewCount: 0n,
        status: 'visible',
        startAt: new Date(now.getTime() - 86400000),
        endAt: new Date(now.getTime() + 7 * 86400000),
        isDirectDeal: false,
        productCondition: 'used',
        thumbnailKey: 'fixture-image',
        tagIds: [],
      },
    });
    auctionId = row.auctionId;
    const storage = { toFullUrl: (key: string) => `/fixture/${key}` } as S3Service;
    const taxonomy = { resolveNames: async () => ({ categoryName: null, tagNames: [] }) } as unknown as TaxonomyUseCase;
    repository = new AuctionEtcRepository(database as unknown as PrismaService, storage, taxonomy);
    service = new AuctionEtcService(
      database as unknown as PrismaService,
      repository,
      notifications as unknown as AuctionEtcFn,
      taxonomy,
      storage,
    );
    input = [{ auctionUuid, bidderUuid, bidAmount: 1000, createdAt: now, requestId: randomUUID() }];
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (auctionUuid)
      await database.$transaction([
        database.outbox.deleteMany({ where: { aggregateType: 'auction', aggregateId: auctionUuid } }),
        database.auctionBidders.deleteMany({ where: { auctionId } }),
        database.auctions.deleteMany({ where: { auctionUuid } }),
      ]);
  });
  afterAll(async () => {
    await database?.$disconnect();
  });

  async function snapshot() {
    const row = await database.auctions.findUniqueOrThrow({ where: { auctionUuid } });
    return {
      currentBid: row.currentBid,
      currentBidderUuid: row.currentBidderUuid,
      bids: await database.auctionBidders.count({ where: { auctionId } }),
      outbox: await database.outbox.count({ where: { aggregateType: 'auction', aggregateId: auctionUuid } }),
    };
  }

  it('does not add an accepted bid or Outbox row when an applied batch is redelivered', async () => {
    await service.bidAuctionBatch(input);
    const first = await snapshot();
    expect(first).toEqual({ currentBid: 1000n, currentBidderUuid: bidderUuid, bids: 1, outbox: 1 });
    await service.bidAuctionBatch(input);
    expect(await snapshot()).toEqual(first);
  });

  it('rolls back the current price and bid when the transaction cannot write its Outbox', async () => {
    vi.spyOn(repository, 'createAuctionOutbox').mockRejectedValueOnce(new Error('fixture outbox failure'));
    await expect(service.bidAuctionBatch(input)).rejects.toThrow('fixture outbox failure');
    expect(await snapshot()).toEqual({ currentBid: 0n, currentBidderUuid: null, bids: 0, outbox: 0 });
    expect(notifications.sendBidMessages).not.toHaveBeenCalled();
  });

  it('retains a successful real transaction despite a post-commit notification failure', async () => {
    notifications.sendBidMessages.mockRejectedValueOnce(new Error('fixture notification failure'));
    await expect(service.bidAuctionBatch(input)).resolves.toBeUndefined();
    expect(await snapshot()).toEqual({ currentBid: 1000n, currentBidderUuid: bidderUuid, bids: 1, outbox: 1 });
  });

  it('redelivers after a simulated offset failure without quarantining or duplicating the committed bid', async () => {
    let handler: NonNullable<ConsumerRunConfig['eachBatch']>;
    const commitOffsets = vi
      .fn()
      .mockRejectedValueOnce(new Error('fixture lost acknowledgement'))
      .mockResolvedValue(undefined);
    const kafka = {
      send: vi.fn(),
      consumer: () => ({
        connect: async () => {},
        subscribe: async () => {},
        disconnect: async () => {},
        commitOffsets,
        run: async (config: ConsumerRunConfig) => {
          handler = config.eachBatch!;
        },
      }),
    };
    const consumer = new AuctionServiceBidderCreatedConsumer(kafka as unknown as KafkaService, service);
    await consumer.onModuleInit();
    const batch = {
      topic: 'auction-service.bidder.created',
      partition: 0,
      messages: [{ offset: '7', value: Buffer.from(JSON.stringify(input[0])) }],
      firstOffset: () => '7',
      lastOffset: () => '7',
    } as Batch;
    const resolveOffset = vi.fn();
    const payload = { batch, resolveOffset } as unknown as EachBatchPayload;
    await expect(handler!(payload)).rejects.toMatchObject({ name: 'KafkaJSError', retriable: true });
    expect(resolveOffset).not.toHaveBeenCalled();
    const persisted = await snapshot();
    expect(persisted).toEqual({ currentBid: 1000n, currentBidderUuid: bidderUuid, bids: 1, outbox: 1 });
    await handler!(payload);
    expect(await snapshot()).toEqual(persisted);
    expect(resolveOffset).toHaveBeenCalledOnce();
    expect(kafka.send).not.toHaveBeenCalled();
    await consumer.onModuleDestroy();
  });
});
