import { randomUUID } from 'node:crypto';
import type { S3Service } from '@app/common/s3/s3.service';
import { PrismaClient } from '../../../../prisma/generated';
import type { PrismaService } from '../../../../prisma/prisma.service';
import type { SavedAuctionPrismaAdapter } from './saved-auction-prisma.adapter';
import { requireTestDatabaseUrl } from '../../../../../../../scripts/test-database.mjs';

const url = process.env.TEST_DATABASE_URL ? requireTestDatabaseUrl(process.env.TEST_DATABASE_URL) : undefined;

describe.skipIf(!url)('saved auctions on isolated PostgreSQL', () => {
  let db: PrismaClient;
  let adapter: SavedAuctionPrismaAdapter;
  let ids: string[];
  let prefix: string;
  let owner: string;
  let other: string;

  beforeAll(async () => {
    const { SavedAuctionPrismaAdapter } = await import('./saved-auction-prisma.adapter');
    db = new PrismaClient({ datasources: { db: { url } } });
    await db.$connect();
    adapter = new SavedAuctionPrismaAdapter(
      db as PrismaService,
      { toFullUrl: (key: string) => '/fixture/' + key } as S3Service,
    );
  });
  beforeEach(() => {
    ids = [];
    prefix = 'saved-fixture-' + randomUUID();
    owner = randomUUID();
    other = randomUUID();
  });
  afterEach(async () => {
    if (ids.length)
      await db.auctions.deleteMany({ where: { auctionUuid: { in: ids }, title: { startsWith: prefix } } });
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  async function auction() {
    const auctionUuid = randomUUID();
    ids.push(auctionUuid);
    return db.auctions.create({
      data: {
        auctionUuid,
        title: prefix,
        description: 'Isolated bookmark fixture',
        minimumBid: 9007199254740993n,
        currentBid: 9007199254740995n,
        sellerUuid: randomUUID(),
        startAt: new Date('2020-01-01Z'),
        endAt: new Date('2099-01-01Z'),
        isDirectDeal: false,
        status: 'visible',
        productCondition: 'used',
        thumbnailKey: 'saved-fixture.png',
      },
    });
  }

  it('persists concurrent idempotent saves as one stable row without financial/event writes', async () => {
    const item = await auction();
    expect(await adapter.save(owner, item.auctionUuid)).toBe(true);
    const before = await db.savedAuction.findUniqueOrThrow({
      where: { memberUuid_auctionUuid: { memberUuid: owner, auctionUuid: item.auctionUuid } },
    });
    expect(await Promise.all(Array.from({ length: 12 }, () => adapter.save(owner, item.auctionUuid)))).toEqual(
      Array(12).fill(true),
    );
    const after = await db.savedAuction.findMany({ where: { memberUuid: owner } });
    expect(after).toHaveLength(1);
    expect(after[0].savedId).toBe(before.savedId);
    expect(after[0].createdAt).toEqual(before.createdAt);
    expect(await db.auctionPurchase.count({ where: { auctionUuid: item.auctionUuid } })).toBe(0);
    expect(await db.outbox.count({ where: { aggregateId: item.auctionUuid } })).toBe(0);
  });

  it('isolates members, retains exact decimal amounts, and scopes repeated removal', async () => {
    const item = await auction();
    await adapter.save(owner, item.auctionUuid);
    expect(await adapter.state(other, item.auctionUuid)).toBe(false);
    expect((await adapter.list(other, null)).items).toEqual([]);
    await adapter.save(other, item.auctionUuid);
    expect((await adapter.list(owner, null)).items[0]).toMatchObject({
      minimumBid: '9007199254740993',
      currentBid: '9007199254740995',
    });
    await adapter.remove(owner, item.auctionUuid);
    await adapter.remove(owner, item.auctionUuid);
    expect(await adapter.state(owner, item.auctionUuid)).toBe(false);
    expect(await adapter.state(other, item.auctionUuid)).toBe(true);
  });

  it.each(['hidden', 'cancelled', 'deleted'] as const)(
    'masks %s auctions and permits cleanup of an old bookmark',
    async (state) => {
      const item = await auction();
      await adapter.save(owner, item.auctionUuid);
      await db.auctions.update({
        where: { auctionUuid: item.auctionUuid },
        data: state === 'deleted' ? { deletedAt: new Date() } : { status: state },
      });
      expect(await adapter.save(owner, item.auctionUuid)).toBe(false);
      expect(await adapter.state(owner, item.auctionUuid)).toBeNull();
      expect((await adapter.list(owner, null)).items).toEqual([]);
      await adapter.remove(owner, item.auctionUuid);
      expect(await db.savedAuction.count({ where: { memberUuid: owner } })).toBe(0);
    },
  );

  it('paginates exact bigint cursors after owner and visibility filters without skips', async () => {
    const rows = [];
    for (let i = 0; i < 25; i++) rows.push(await auction());
    const base = 9007199254740993n;
    await db.savedAuction.createMany({
      data: rows.map((row, index) => ({
        savedId: base + BigInt(index),
        memberUuid: owner,
        auctionUuid: row.auctionUuid,
      })),
    });
    await db.savedAuction.create({
      data: { savedId: base + 10000n, memberUuid: other, auctionUuid: rows[0].auctionUuid },
    });
    await db.auctions.update({ where: { auctionUuid: rows[10].auctionUuid }, data: { status: 'hidden' } });
    await db.auctions.update({ where: { auctionUuid: rows[20].auctionUuid }, data: { status: 'cancelled' } });
    await db.auctions.update({ where: { auctionUuid: rows[24].auctionUuid }, data: { deletedAt: new Date() } });
    const page1 = await adapter.list(owner, null);
    expect(page1.items).toHaveLength(20);
    expect(page1.nextCursor).toBe('9007199254740995');
    const page2 = await adapter.list(owner, page1.nextCursor);
    expect(page2.items.map((item) => item.auctionUuid)).toEqual([rows[1].auctionUuid, rows[0].auctionUuid]);
    expect(page2.nextCursor).toBeNull();
    const expected = rows
      .filter((_, index) => ![10, 20, 24].includes(index))
      .reverse()
      .map((row) => row.auctionUuid);
    expect([...page1.items, ...page2.items].map((item) => item.auctionUuid)).toEqual(expected);
  });

  it('cascades physical auction deletion and reports unknown targets without creating rows', async () => {
    const item = await auction();
    await adapter.save(owner, item.auctionUuid);
    await db.auctions.delete({ where: { auctionUuid: item.auctionUuid } });
    expect(await db.savedAuction.count({ where: { auctionUuid: item.auctionUuid } })).toBe(0);
    expect(await adapter.save(owner, item.auctionUuid)).toBe(false);
    expect(await adapter.state(owner, item.auctionUuid)).toBeNull();
  });
});
