import { randomUUID } from 'node:crypto';
import type { S3Service } from '@app/common/s3/s3.service';
import { PrismaClient, type Prisma } from '../../../../prisma/generated';
import type { PrismaService } from '../../../../prisma/prisma.service';
import type { MySalesPrismaAdapter } from './my-sales-prisma.adapter';
import type { MySalesQuery } from '../../../application/model/my-sales.result';
import { requireTestDatabaseUrl } from '../../../../../../../scripts/test-database.mjs';

const url = process.env.TEST_DATABASE_URL ? requireTestDatabaseUrl(process.env.TEST_DATABASE_URL) : undefined;
describe.skipIf(!url)('my sales on isolated PostgreSQL', () => {
  let db: PrismaClient;
  let adapter: MySalesPrismaAdapter;
  let ids: string[];
  let owner: string;
  let other: string;
  let prefix: string;
  const now = new Date('2026-10-30T00:00:00Z');
  const query: MySalesQuery = { q: '', status: 'all', sort: 'recent', page: 1 };
  beforeAll(async () => {
    const { MySalesPrismaAdapter } = await import('./my-sales-prisma.adapter');
    db = new PrismaClient({ datasources: { db: { url } } });
    await db.$connect();
    adapter = new MySalesPrismaAdapter(
      db as PrismaService,
      { toFullUrl: (key: string) => '/fixture/' + key } as S3Service,
    );
  });
  beforeEach(() => {
    ids = [];
    owner = randomUUID();
    other = randomUUID();
    prefix = 'sales-fixture-' + randomUUID();
  });
  afterEach(async () => {
    if (ids.length) {
      await db.auctionBidders.deleteMany({
        where: { auction: { auctionUuid: { in: ids }, title: { startsWith: prefix } } },
      });
      await db.auctions.deleteMany({ where: { auctionUuid: { in: ids }, title: { startsWith: prefix } } });
    }
  });
  afterAll(async () => {
    await db?.$disconnect();
  });
  async function auction(patch: Partial<Prisma.AuctionsUncheckedCreateInput> = {}) {
    const auctionUuid = randomUUID();
    ids.push(auctionUuid);
    return db.auctions.create({
      data: {
        auctionUuid,
        title: prefix,
        description: 'Private seller fixture',
        sellerUuid: owner,
        minimumBid: 9007199254740993n,
        currentBid: 9007199254740995n,
        startAt: new Date('2020-01-01T00:00:00Z'),
        endAt: new Date('2099-01-01T00:00:00Z'),
        createdAt: now,
        status: 'visible',
        isDirectDeal: false,
        productCondition: 'used',
        thumbnailKey: 'sale.png',
        ...patch,
      },
    });
  }
  it('isolates seller, excludes deleted rows, counts statuses at exact server boundaries', async () => {
    const active = await auction({ startAt: now });
    await auction({ endAt: now });
    await auction({ startAt: new Date(now.getTime() + 1) });
    await auction({ status: 'hidden' });
    await auction({ status: 'cancelled' });
    await auction({ deletedAt: now });
    await auction({ sellerUuid: other });
    const result = await adapter.list(owner, query, now);
    expect(result.summary).toEqual({ total: 5, waiting: 1, active: 1, ended: 1, hidden: 1, cancelled: 1 });
    expect(result.total).toBe(5);
    expect(result.items).toHaveLength(5);
    expect(result.items.find((row) => row.auctionUuid === active.auctionUuid)?.status).toBe('active');
    expect((await adapter.list(other, query, now)).items).toHaveLength(1);
    expect((await adapter.list(randomUUID(), query, now)).summary.total).toBe(0);
  });
  it('filters literal case-insensitive search and status without altering full summary', async () => {
    const match = await auction({ title: prefix + " CAMERA %_' " });
    await auction({ title: prefix + ' camera ABC' });
    await auction({ title: prefix + " CAMERA %_' hidden", status: 'hidden' });
    const result = await adapter.list(owner, { ...query, q: "camera %_'", status: 'active' }, now);
    expect(result.items.map((item) => item.auctionUuid)).toEqual([match.auctionUuid]);
    expect(result.total).toBe(1);
    expect(result.summary.total).toBe(3);
    expect((await adapter.list(owner, { ...query, q: "' OR 1=1 --" }, now)).total).toBe(0);
  });
  it('preserves large prices and counts bid records excluding deleted bids with no financial/event writes', async () => {
    const item = await auction();
    await db.auctionBidders.createMany({
      data: [0, 1, 2].map((i) => ({
        auctionId: item.auctionId,
        bidderUuid: other,
        bidAmount: 9007199254740995n,
        deletedAt: i === 2 ? now : null,
      })),
    });
    const result = await adapter.list(owner, query, now);
    expect(result.items[0]).toMatchObject({
      minimumBid: '9007199254740993',
      currentBid: '9007199254740995',
      bidCount: 2,
      thumbnailUrl: '/fixture/sale.png',
    });
    expect(result.items[0]).not.toHaveProperty('sellerUuid');
    expect(await db.auctionPurchase.count({ where: { auctionUuid: item.auctionUuid } })).toBe(0);
    expect(await db.outbox.count({ where: { aggregateId: item.auctionUuid } })).toBe(0);
  });
  it('paginates ties deterministically and returns counts for an out-of-range page', async () => {
    const created = [];
    for (let i = 0; i < 23; i++) created.push(await auction());
    const first = await adapter.list(owner, query, now);
    const second = await adapter.list(owner, { ...query, page: 2 }, now);
    expect(first.items.map((item) => item.auctionUuid)).toEqual(
      created
        .slice(3)
        .reverse()
        .map((item) => item.auctionUuid),
    );
    expect(second.items.map((item) => item.auctionUuid)).toEqual(
      created
        .slice(0, 3)
        .reverse()
        .map((item) => item.auctionUuid),
    );
    const beyond = await adapter.list(owner, { ...query, page: 3 }, now);
    expect(beyond.items).toEqual([]);
    expect(beyond.total).toBe(23);
  });
  it('sorts exact prices with minimum fallback and ending times with deterministic ties', async () => {
    const first = await auction({
      endAt: new Date('2098-01-01T00:00:00Z'),
      minimumBid: 9007199254740996n,
      currentBid: 0n,
    });
    const second = await auction({ endAt: new Date('2097-01-01T00:00:00Z') });
    const third = await auction({ endAt: second.endAt });
    expect((await adapter.list(owner, { ...query, sort: 'price' }, now)).items.map((row) => row.auctionUuid)).toEqual([
      first.auctionUuid,
      third.auctionUuid,
      second.auctionUuid,
    ]);
    expect((await adapter.list(owner, { ...query, sort: 'ending' }, now)).items.map((row) => row.auctionUuid)).toEqual([
      third.auctionUuid,
      second.auctionUuid,
      first.auctionUuid,
    ]);
  });
});
