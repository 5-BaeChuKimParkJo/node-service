import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '../../../../prisma/generated';
import type { PrismaService } from '../../../../prisma/prisma.service';
import type { S3Service } from '@app/common/s3/s3.service';
import type { TaxonomyUseCase } from '../../../../taxonomy/application/port/in/taxonomy.use-case';
import type { AuctionPrismaAdapter } from './auction-prisma.adapter';
import NewAuction from '../../../domain/model/new-auction';
import { CreateAuctionWebMapper } from '../../in/web/mapper/create-auction-web.mapper';
import type { CreateAuctionRequest } from '../../in/web/dto/create-auction.dto';
import { requireTestDatabaseUrl } from '../../../../../../../scripts/test-database.mjs';
import { CreateAuctionBidderService } from '../../../application/service/create-auction-bidder.service';
import { AuctionService } from '../../../application/service/auction.service';
import { AuctionMapper } from '../../../application/mapper/auction.mapper';
import { AuctionWebMapper } from '../../in/web/mapper/auction-web.mapper';
import { PaymentService } from '../../../../payment/application/service/payment.service';
import { PaymentPrismaAdapter } from '../../../../payment/adapter/out/persistence/payment-prisma.adapter';
import { PaymentProviderPort } from '../../../../payment/application/port/out/payment-provider.port';
import { ConfigService } from '@nestjs/config';

const url = process.env.TEST_DATABASE_URL ? requireTestDatabaseUrl(process.env.TEST_DATABASE_URL) : undefined;
const now = new Date('2020-06-15T12:30:00Z');
const startAt = new Date('2020-06-15T12:00:00Z');
const endAt = new Date('2020-06-16T12:00:00Z');

describe.skipIf(!url)('managed demo creation on isolated PostgreSQL', () => {
  let database: PrismaClient;
  let rival: PrismaClient;
  let adapter: AuctionPrismaAdapter;
  let rivalAdapter: AuctionPrismaAdapter;
  let templateUuid: string;
  let sellerUuid: string;
  let key: string;
  let tracked: string[];
  let Adapter: typeof import('./auction-prisma.adapter').AuctionPrismaAdapter;
  const storage = { toFullUrl: (value: string) => `/fixture/${value}` } as S3Service;
  const taxonomy = { resolveNames: async () => ({ categoryName: null, tagNames: [] }) } as unknown as TaxonomyUseCase;

  beforeAll(async () => {
    ({ AuctionPrismaAdapter: Adapter } = await import('./auction-prisma.adapter'));
    database = new PrismaClient({ datasources: { db: { url } } });
    rival = new PrismaClient({ datasources: { db: { url } } });
    await database.$connect();
    await rival.$connect();
    adapter = new Adapter(database as PrismaService, storage, taxonomy);
    rivalAdapter = new Adapter(rival as PrismaService, storage, taxonomy);
  });
  beforeEach(async () => {
    templateUuid = randomUUID();
    sellerUuid = randomUUID();
    key = `${sellerUuid}_${randomUUID()}.webp`;
    tracked = [];
    await seed({
      auctionUuid: templateUuid,
      title: '[DEMO-016] Camera template',
      startAt: new Date('2020-06-14T10:00:00Z'),
      endAt: new Date('2020-06-14T11:00:00Z'),
      currentBid: 1320n,
    });
  });
  afterEach(async () => {
    const where = { OR: [{ auctionUuid: { in: tracked } }, { demoTemplateUuid: templateUuid }] };
    const rows = await database.auctions.findMany({ where, select: { auctionUuid: true, auctionId: true } });
    await database.$transaction([
      database.outbox.deleteMany({
        where: { aggregateType: 'auction', aggregateId: { in: rows.map((row) => row.auctionUuid) } },
      }),
      database.auctionViewed.deleteMany({ where: { auctionUuid: { in: rows.map((row) => row.auctionUuid) } } }),
      database.auctionBidders.deleteMany({ where: { auctionId: { in: rows.map((row) => row.auctionId) } } }),
      database.auctionImages.deleteMany({ where: { auctionId: { in: rows.map((row) => row.auctionId) } } }),
      database.auctions.deleteMany({ where }),
    ]);
  });
  afterAll(async () => {
    await database?.$disconnect();
    await rival?.$disconnect();
  });

  async function seed(patch: Partial<Prisma.AuctionsUncheckedCreateInput> = {}) {
    const auctionUuid = patch.auctionUuid ?? randomUUID();
    tracked.push(auctionUuid);
    return database.auctions.create({
      data: {
        auctionUuid,
        title: '[DEMO] Camera fixture',
        description: 'Isolated demo fixture',
        minimumBid: 1000n,
        currentBid: 0n,
        sellerUuid,
        startAt,
        endAt,
        isDirectDeal: false,
        status: 'visible',
        productCondition: 'used',
        thumbnailKey: key,
        ...patch,
      },
    });
  }
  function input() {
    return new NewAuction(
      {
        title: '[DEMO] Camera fixture',
        description: 'Isolated demo fixture',
        categoryId: null,
        minimumBid: 1000n,
        startAt,
        endAt,
        productCondition: 'used',
        isDirectDeal: false,
        directDealLocation: null,
        thumbnailKey: key,
        tagIds: [],
        images: [{ key, order: 0 }],
      },
      { memberUuid: sellerUuid, role: 'member' },
    );
  }
  const context = (mode: 'manual' | 'automatic' = 'automatic') => ({ templateUuid, mode, now });
  const children = () => database.auctions.findMany({ where: { demoTemplateUuid: templateUuid } });

  it('reads and bids on a minute-scheduled demo, rejects late bids, and exposes checkout only to its winner', async () => {
    const start = new Date(Date.now() - 60000);
    const end = new Date(start.getTime() + 300000);
    const bidderUuid = randomUUID();
    const prepared = NewAuction.forDemo(
      { ...input().getSnapshot(), startAt: start, endAt: end },
      { memberUuid: sellerUuid, role: 'member' },
    );
    const result = await adapter.createDemoAuction(prepared, context('manual'));
    expect(result.status).toBe('created');
    const [row] = await children();
    const detail = new AuctionService(adapter, new AuctionMapper(storage), taxonomy);
    const response = AuctionWebMapper.fromResponse(
      await detail.execute({ type: 'user', auctionUuid: row.auctionUuid }),
    );
    expect(response).toMatchObject({
      isDemo: true,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      status: 'active',
    });
    expect(response).not.toHaveProperty('demoTemplateUuid');
    expect((await adapter.findAuction({ type: 'admin', auctionUuid: row.auctionUuid })).getSnapshot().endAt).toEqual(
      end,
    );
    const bidder = new CreateAuctionBidderService(adapter);
    await bidder.execute(
      { auctionUuid: row.auctionUuid, bidAmount: 1200n },
      { memberUuid: bidderUuid, role: 'member' },
    );
    expect(await database.auctionBidders.count({ where: { auctionId: row.auctionId } })).toBe(1);
    const payment = new PaymentService(
      new PaymentPrismaAdapter(database as PrismaService),
      {} as PaymentProviderPort,
      new ConfigService({ TOSS_PAYMENTS_ENABLED: true, TOSS_CLIENT_KEY: 'test_gck_fixture' }),
    );
    expect(await payment.get(row.auctionUuid, bidderUuid)).toMatchObject({
      eligible: false,
      reason: 'AUCTION_NOT_ENDED',
    });
    await database.auctions.update({
      where: { auctionUuid: row.auctionUuid },
      data: { endAt: new Date(Date.now() - 1000) },
    });
    await expect(
      bidder.execute({ auctionUuid: row.auctionUuid, bidAmount: 1250n }, { memberUuid: randomUUID(), role: 'member' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await payment.get(row.auctionUuid, bidderUuid)).toMatchObject({ eligible: true, purchase: null });
    await expect(payment.get(row.auctionUuid, randomUUID())).rejects.toMatchObject({ status: 403 });
    await expect(payment.get(row.auctionUuid, sellerUuid)).rejects.toMatchObject({ status: 403 });
    expect(await database.auctionPurchase.count({ where: { auctionUuid: row.auctionUuid } })).toBe(0);
    const events = await database.outbox.findMany({ where: { aggregateId: row.auctionUuid } });
    expect(events).toHaveLength(2);
    for (const event of events) expect(event.payload).not.toHaveProperty('demoTemplateUuid');
  });

  it('commits one fresh marked row with one public outbox and preserves the complete source row', async () => {
    const before = await database.auctions.findUniqueOrThrow({ where: { auctionUuid: templateUuid } });
    const result = await adapter.createDemoAuction(input(), context());
    expect(result.status).toBe('created');
    const rows = await children();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      demoTemplateUuid: templateUuid,
      currentBid: 0n,
      currentBidderUuid: null,
      soldAt: null,
      viewCount: 0n,
    });
    const events = await database.outbox.findMany({ where: { aggregateId: rows[0].auctionUuid } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ aggregateType: 'auction', eventType: 'AuctionCreated', op: 'c' });
    expect(events[0].payload).not.toHaveProperty('demoTemplateUuid');
    expect(await database.auctions.findUniqueOrThrow({ where: { auctionUuid: templateUuid } })).toEqual(before);
    await expect(adapter.createDemoAuction(input(), context())).resolves.toEqual({ status: 'skipped-active' });
    expect(await children()).toHaveLength(1);
  });

  it.each(['source', 'child'])('counts an eligible %s including the exact start boundary', async (kind) => {
    if (kind === 'source')
      await database.auctions.update({ where: { auctionUuid: templateUuid }, data: { startAt: now, endAt } });
    else await seed({ demoTemplateUuid: templateUuid, startAt: now });
    await expect(adapter.createDemoAuction(input(), context())).resolves.toEqual({ status: 'skipped-active' });
    expect(await children()).toHaveLength(kind === 'child' ? 1 : 0);
  });

  it.each([
    { endAt: now },
    { startAt: new Date('2020-06-15T13:00:00Z') },
    { status: 'hidden' },
    { status: 'cancelled' },
    { deletedAt: now },
    { soldAt: now },
    { checkoutLockedAt: now },
  ] as Partial<Prisma.AuctionsUncheckedCreateInput>[])('does not count an unavailable child: %j', async (patch) => {
    await seed({ demoTemplateUuid: templateUuid, ...patch });
    await expect(adapter.createDemoAuction(input(), context())).resolves.toMatchObject({ status: 'created' });
    expect(await children()).toHaveLength(2);
  });

  it('ignores unmarked lookalikes and children of another template', async () => {
    await seed();
    await seed({ demoTemplateUuid: randomUUID() });
    await expect(adapter.createDemoAuction(input(), context())).resolves.toMatchObject({ status: 'created' });
    expect(await children()).toHaveLength(1);
  });

  it('serializes independent client pools so simultaneous ticks create just one row and outbox', async () => {
    const results = await Promise.all([
      adapter.createDemoAuction(input(), context()),
      rivalAdapter.createDemoAuction(input(), context()),
    ]);
    expect(results.filter((result) => result.status === 'created')).toHaveLength(1);
    const rows = await children();
    expect(rows).toHaveLength(1);
    expect(
      await database.outbox.count({ where: { aggregateId: rows[0].auctionUuid, eventType: 'AuctionCreated' } }),
    ).toBe(1);
    expect(results.every((result) => ['created', 'skipped-busy', 'skipped-active'].includes(result.status))).toBe(true);
  });

  it.each(['manual', 'automatic'] as const)(
    'does not wait on an advisory lock held by another %s writer',
    async (mode) => {
      await database.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`chalnak:demo:${templateUuid}`}, 0))::text`,
        );
        await expect(rivalAdapter.createDemoAuction(input(), context(mode))).resolves.toEqual({
          status: 'skipped-busy',
        });
      });
      expect(await children()).toHaveLength(0);
    },
  );

  it('rolls back the actual auction insert when its outbox insert fails and releases the lock', async () => {
    const failingPrisma = {
      $transaction: (work: (tx: Prisma.TransactionClient) => unknown) =>
        database.$transaction(async (tx) =>
          work({
            $queryRaw: tx.$queryRaw.bind(tx),
            auctions: tx.auctions,
            outbox: {
              create: async () => {
                throw new Error('Injected outbox failure');
              },
            },
          } as unknown as Prisma.TransactionClient),
        ),
    } as unknown as PrismaService;
    const failing = new Adapter(failingPrisma, storage, taxonomy);
    await expect(failing.createDemoAuction(input(), context())).rejects.toThrow('Injected outbox failure');
    expect(await children()).toHaveLength(0);
    await expect(rivalAdapter.createDemoAuction(input(), context())).resolves.toMatchObject({ status: 'created' });
  });

  it('coordinates manual creation with automatic checks while preserving deliberate manual overrides', async () => {
    await expect(adapter.createDemoAuction(input(), context('manual'))).resolves.toMatchObject({ status: 'created' });
    await expect(rivalAdapter.createDemoAuction(input(), context())).resolves.toEqual({ status: 'skipped-active' });
    await expect(rivalAdapter.createDemoAuction(input(), context('manual'))).resolves.toMatchObject({
      status: 'created',
    });
    expect(await children()).toHaveLength(2);
  });

  it.each([
    { status: 'hidden' },
    { deletedAt: now },
    { title: 'Ordinary camera' },
  ] as Partial<Prisma.AuctionsUncheckedCreateInput>[])(
    'rechecks source eligibility changed after preflight: %j',
    async (patch) => {
      const prepared = input();
      await database.auctions.update({ where: { auctionUuid: templateUuid }, data: patch });
      await expect(adapter.createDemoAuction(prepared, context())).rejects.toMatchObject({ status: 409 });
      expect(await children()).toHaveLength(0);
    },
  );

  it('never persists forged private provenance on the ordinary public creation path', async () => {
    const command = CreateAuctionWebMapper.toCommand({
      title: 'Ordinary camera',
      description: 'Public fixture',
      categoryId: null,
      minimumBid: 1000,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      productCondition: 'used',
      isDirectDeal: false,
      directDealLocation: null,
      thumbnailKey: key,
      tagIds: [],
      images: [{ key, order: 0 }],
      demoTemplateUuid: templateUuid,
    } as CreateAuctionRequest);
    const result = await adapter.createAuction(new NewAuction(command, { memberUuid: sellerUuid, role: 'member' }));
    tracked.push(result.getSnapshot().auctionUuid);
    const row = await database.auctions.findUniqueOrThrow({ where: { auctionUuid: result.getSnapshot().auctionUuid } });
    expect(row.demoTemplateUuid).toBeNull();
  });
});
