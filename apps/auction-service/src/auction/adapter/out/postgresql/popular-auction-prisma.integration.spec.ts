import { randomUUID } from 'node:crypto';
import type { S3Service } from '@app/common/s3/s3.service';
import { Prisma, PrismaClient } from '../../../../prisma/generated';
import type { PrismaService } from '../../../../prisma/prisma.service';
import type { PopularAuctionPrismaAdapter } from './popular-auction-prisma.adapter';
import { requireTestDatabaseUrl } from '../../../../../../../scripts/test-database.mjs';

const url = process.env.TEST_DATABASE_URL ? requireTestDatabaseUrl(process.env.TEST_DATABASE_URL) : undefined;

describe.skipIf(!url)('popular auction ranking on isolated PostgreSQL', () => {
  const now = new Date('2020-06-15T12:00:00.000Z');
  const recent = new Date('2020-06-15T11:59:59.000Z');
  const sellerUuid = randomUUID();
  let database: PrismaClient;
  let adapter: PopularAuctionPrismaAdapter;
  let auctionUuids: string[];
  let prefix: string;

  beforeAll(async () => {
    const { PopularAuctionPrismaAdapter } = await import('./popular-auction-prisma.adapter');
    database = new PrismaClient({ datasources: { db: { url } } });
    await database.$connect();
    adapter = new PopularAuctionPrismaAdapter(
      database as PrismaService,
      {
        toFullUrl: (key: string) => `https://fixture.invalid/${key}`,
      } as S3Service,
    );
  });

  beforeEach(() => {
    auctionUuids = [];
    prefix = `popular-integration-${randomUUID()}`;
  });

  afterEach(async () => {
    const where = { auctionUuid: { in: auctionUuids } };
    await database.$transaction([
      database.auctionViewed.deleteMany({ where }),
      database.auctionBidders.deleteMany({ where: { auction: where } }),
      database.auctions.deleteMany({ where }),
    ]);
  });

  afterAll(async () => {
    await database?.$disconnect();
  });

  async function auction(patch: Partial<Prisma.AuctionsUncheckedCreateInput> = {}) {
    const auctionUuid = patch.auctionUuid ?? randomUUID();
    auctionUuids.push(auctionUuid);
    return database.auctions.create({
      data: {
        title: `${prefix}-${auctionUuid}`,
        description: 'Isolated popular auction fixture',
        minimumBid: 100n,
        currentBid: 200n,
        sellerUuid,
        startAt: new Date('2020-06-15T11:00:00.000Z'),
        endAt: new Date('2020-06-15T13:00:00.000Z'),
        isDirectDeal: false,
        status: 'visible',
        productCondition: 'used',
        thumbnailKey: `${prefix}.webp`,
        ...patch,
        auctionUuid,
      },
    });
  }

  async function views(auctionUuid: string, viewerUuids: string[], viewedAt = recent) {
    await database.auctionViewed.createMany({
      data: viewerUuids.map((viewerUuid) => ({ auctionUuid, viewerUuid, viewedAt })),
    });
  }

  async function bids(
    auctionId: bigint,
    bidderUuids: string[],
    createdAt = recent,
    patch: Partial<Prisma.AuctionBiddersCreateManyInput> = {},
  ) {
    await database.auctionBidders.createMany({
      data: bidderUuids.map((bidderUuid) => ({ auctionId, bidderUuid, bidAmount: 200n, createdAt, ...patch })),
    });
  }

  it('counts distinct people without multiplying joined rows or counting seller and invalid-only activity', async () => {
    const mixed = await auction();
    const viewOnly = await auction();
    const bidOnly = await auction();
    const excludedOnly = await auction({ viewCount: 999999n });
    const first = randomUUID();
    const second = randomUUID();
    await views(mixed.auctionUuid, [first, first, second, sellerUuid]);
    await bids(mixed.auctionId, [first, first, second, sellerUuid]);
    await bids(mixed.auctionId, [randomUUID()], recent, { bidAmount: 0n });
    await bids(mixed.auctionId, [randomUUID()], recent, { bidAmount: -1n });
    await bids(mixed.auctionId, [randomUUID()], recent, { deletedAt: recent });
    await views(viewOnly.auctionUuid, [randomUUID()]);
    await bids(bidOnly.auctionId, [randomUUID()]);
    await views(excludedOnly.auctionUuid, [sellerUuid]);
    await bids(excludedOnly.auctionId, [sellerUuid]);
    await bids(excludedOnly.auctionId, [randomUUID()], recent, { bidAmount: 0n });
    await bids(excludedOnly.auctionId, [randomUUID()], recent, { bidAmount: -1n });
    await bids(excludedOnly.auctionId, [randomUUID()], recent, { deletedAt: recent });

    expect(await adapter.rank(now)).toEqual([
      { auctionUuid: mixed.auctionUuid, uniqueViewers: '2', uniqueBidders: '2', score: '12' },
      { auctionUuid: bidOnly.auctionUuid, uniqueViewers: '0', uniqueBidders: '1', score: '5' },
      { auctionUuid: viewOnly.auctionUuid, uniqueViewers: '1', uniqueBidders: '0', score: '1' },
    ]);
  });

  it('includes the 24-hour lower boundary and excludes now, older rows, and future rows for both activity types', async () => {
    const active = await auction();
    const outsideOnly = await auction();
    for (const timestamp of [
      '2020-06-14T11:59:59.999Z',
      '2020-06-14T12:00:00.000Z',
      '2020-06-15T11:59:59.999Z',
      '2020-06-15T12:00:00.000Z',
      '2020-06-15T12:00:00.001Z',
    ]) {
      await views(active.auctionUuid, [randomUUID()], new Date(timestamp));
      await bids(active.auctionId, [randomUUID()], new Date(timestamp));
    }
    for (const timestamp of ['2020-06-14T11:59:59.999Z', '2020-06-15T12:00:00.001Z']) {
      await views(outsideOnly.auctionUuid, [randomUUID()], new Date(timestamp));
      await bids(outsideOnly.auctionId, [randomUUID()], new Date(timestamp));
    }

    expect(await adapter.rank(now)).toEqual([
      { auctionUuid: active.auctionUuid, uniqueViewers: '2', uniqueBidders: '2', score: '12' },
    ]);
  });

  it('ranks only visible, started, unended, unsold, undeleted auctions', async () => {
    const startedNow = await auction({ startAt: now });
    await views(startedNow.auctionUuid, [randomUUID()]);
    const excluded: Array<Partial<Prisma.AuctionsUncheckedCreateInput>> = [
      { status: 'hidden' },
      { status: 'cancelled' },
      { startAt: new Date('2020-06-15T12:00:00.001Z') },
      { endAt: now },
      { endAt: recent },
      { soldAt: recent },
      { deletedAt: recent },
    ];
    for (const patch of excluded) {
      const inactive = await auction(patch);
      await views(inactive.auctionUuid, [randomUUID()]);
      await bids(inactive.auctionId, [randomUUID()]);
    }

    expect(await adapter.rank(now)).toEqual([
      { auctionUuid: startedNow.auctionUuid, uniqueViewers: '1', uniqueBidders: '0', score: '1' },
    ]);
  });

  it('limits positive scores to ten using score, bidder count, viewer count, end time, and UUID tie ordering', async () => {
    const highest = await auction();
    await views(highest.auctionUuid, [randomUUID(), randomUUID()]);
    await bids(highest.auctionId, [randomUUID(), randomUUID()]);
    const mostBidders = await auction();
    await bids(mostBidders.auctionId, [randomUUID(), randomUUID()]);
    const oneBidder = await auction({ endAt: new Date('2020-06-15T12:00:00.100Z') });
    await views(
      oneBidder.auctionUuid,
      Array.from({ length: 5 }, () => randomUUID()),
    );
    await bids(oneBidder.auctionId, [randomUUID()]);
    const mostViewers = await auction({ endAt: new Date('2020-06-15T12:00:00.010Z') });
    await views(
      mostViewers.auctionUuid,
      Array.from({ length: 10 }, () => randomUUID()),
    );
    const tiedUuids = Array.from({ length: 9 }, () => randomUUID()).sort();
    // Reverse insertion and conflicting UUID/end-time order expose unstable tie ordering.
    for (let index = tiedUuids.length - 1; index >= 0; index--) {
      const tied = await auction({
        auctionUuid: tiedUuids[index],
        endAt: new Date(index >= 7 ? '2020-06-15T12:00:01.000Z' : '2020-06-15T12:00:02.000Z'),
      });
      await views(tied.auctionUuid, [randomUUID()]);
    }
    await auction({ viewCount: 999999n });

    expect(await adapter.rank(now)).toEqual([
      { auctionUuid: highest.auctionUuid, uniqueViewers: '2', uniqueBidders: '2', score: '12' },
      { auctionUuid: mostBidders.auctionUuid, uniqueViewers: '0', uniqueBidders: '2', score: '10' },
      { auctionUuid: oneBidder.auctionUuid, uniqueViewers: '5', uniqueBidders: '1', score: '10' },
      { auctionUuid: mostViewers.auctionUuid, uniqueViewers: '10', uniqueBidders: '0', score: '10' },
      ...[tiedUuids[7], tiedUuids[8], ...tiedUuids.slice(0, 4)].map((auctionUuid) => ({
        auctionUuid,
        uniqueViewers: '1',
        uniqueBidders: '0',
        score: '1',
      })),
    ]);
  });

  it('rechecks cached UUID eligibility and returns only public fields with lossless bigint prices', async () => {
    const active = await auction({
      startAt: now,
      minimumBid: 9007199254740993n,
      currentBid: 9007199254741999n,
      currentBidderUuid: randomUUID(),
    });
    const changes: Array<Partial<Prisma.AuctionsUncheckedUpdateInput>> = [
      { status: 'hidden' },
      { status: 'cancelled' },
      { startAt: new Date('2020-06-15T12:00:02.000Z') },
      { soldAt: now },
      { deletedAt: now },
    ];
    const changed = [];
    for (const patch of changes) {
      changed.push({ row: await auction(), patch });
    }
    const closing = await auction({ endAt: new Date('2020-06-15T12:00:01.000Z') });
    for (const row of [active, closing, ...changed.map(({ row }) => row)]) {
      await views(row.auctionUuid, [randomUUID()]);
    }
    const cachedUuids = (await adapter.rank(now)).map((row) => row.auctionUuid);
    expect(new Set(cachedUuids)).toEqual(new Set(auctionUuids));
    for (const { row, patch } of changed) {
      await database.auctions.update({ where: { auctionUuid: row.auctionUuid }, data: patch });
    }
    await database.auctions.update({
      where: { auctionUuid: active.auctionUuid },
      data: { title: `${prefix}-updated`, currentBid: 9007199254742001n },
    });

    expect(await adapter.findActive([...cachedUuids, randomUUID()], closing.endAt)).toEqual([
      {
        auctionUuid: active.auctionUuid,
        title: `${prefix}-updated`,
        thumbnailUrl: `https://fixture.invalid/${prefix}.webp`,
        minimumBid: 9007199254740993n,
        currentBid: 9007199254742001n,
        startAt: now,
        endAt: active.endAt,
      },
    ]);
    expect(await adapter.findActive([], now)).toEqual([]);
  });

  it('records real visitors only for eligible auctions and deduplicates repeated view requests in ranking', async () => {
    const active = await auction({ startAt: now });
    const viewerUuid = randomUUID();
    const nonexistentUuid = randomUUID();
    auctionUuids.push(nonexistentUuid);
    const excluded: Array<Partial<Prisma.AuctionsUncheckedCreateInput>> = [
      { status: 'hidden' },
      { status: 'cancelled' },
      { startAt: new Date('2020-06-15T12:00:00.001Z') },
      { endAt: now },
      { soldAt: recent },
      { deletedAt: recent },
    ];
    await expect(
      adapter.recordView({ auctionUuid: active.auctionUuid, viewerUuid: sellerUuid }, now),
    ).resolves.toBeUndefined();
    await expect(adapter.recordView({ auctionUuid: nonexistentUuid, viewerUuid }, now)).resolves.toBeUndefined();
    for (const patch of excluded) {
      const inactive = await auction(patch);
      await expect(adapter.recordView({ auctionUuid: inactive.auctionUuid, viewerUuid }, now)).resolves.toBeUndefined();
    }
    const recorded = () =>
      database.auctionViewed.findMany({
        where: { auctionUuid: { in: auctionUuids } },
        select: { auctionUuid: true, viewerUuid: true, viewedAt: true },
      });
    expect(await recorded()).toEqual([]);

    await expect(adapter.recordView({ auctionUuid: active.auctionUuid, viewerUuid }, now)).resolves.toBeUndefined();
    await expect(adapter.recordView({ auctionUuid: active.auctionUuid, viewerUuid }, now)).resolves.toBeUndefined();
    const rows = await recorded();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(row).toEqual({ auctionUuid: active.auctionUuid, viewerUuid, viewedAt: now });
    }
    expect(await adapter.rank(new Date('2020-06-15T12:00:00.001Z'))).toEqual([
      { auctionUuid: active.auctionUuid, uniqueViewers: '1', uniqueBidders: '0', score: '1' },
    ]);
  });
});
