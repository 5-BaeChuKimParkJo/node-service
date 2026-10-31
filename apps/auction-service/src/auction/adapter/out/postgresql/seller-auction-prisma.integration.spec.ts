import { randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma } from '../../../../prisma/generated';
import type { PrismaService } from '../../../../prisma/prisma.service';
import type { SellerAuctionPrismaAdapter } from './seller-auction-prisma.adapter';
import type { S3Service } from '@app/common/s3/s3.service';
import type { TaxonomyUseCase } from '../../../../taxonomy/application/port/in/taxonomy.use-case';
import { parseSellerAuctionChange } from '../../../domain/model/seller-auction-policy';
import { requireTestDatabaseUrl } from '../../../../../../../scripts/test-database.mjs';

const url = process.env.TEST_DATABASE_URL ? requireTestDatabaseUrl(process.env.TEST_DATABASE_URL) : undefined;
describe.skipIf(!url)('seller writes on isolated PostgreSQL', () => {
  let db: PrismaClient;
  let adapter: SellerAuctionPrismaAdapter;
  let ids: string[];
  let owner: string;
  let prefix: string;
  const media = { toFullUrl: (key: string) => '/fixture/' + key } as S3Service;
  const taxonomy = { resolveNames: async () => ({ categoryName: null, tagNames: [] }) } as unknown as TaxonomyUseCase;
  const input = () => ({
    version: 0,
    title: '변경한 판매자 테스트 경매',
    description: '변경한 설명',
    minimumBid: '2500',
    startAt: '2098-01-01T00:00:00Z',
    endAt: '2098-01-02T00:00:00Z',
  });
  beforeAll(async () => {
    const { SellerAuctionPrismaAdapter: Adapter } = await import('./seller-auction-prisma.adapter');
    db = new PrismaClient({ datasources: { db: { url } } });
    await db.$connect();
    adapter = new Adapter(db as PrismaService, media, taxonomy);
  });
  beforeEach(() => {
    ids = [];
    owner = randomUUID();
    prefix = 'seller-write-fixture-' + randomUUID();
  });
  afterEach(async () => {
    if (!ids.length) return;
    await db.auctionSellerAction.deleteMany({ where: { auctionUuid: { in: ids } } });
    await db.outbox.deleteMany({ where: { aggregateId: { in: ids } } });
    await db.auctionPurchase.deleteMany({ where: { auctionUuid: { in: ids } } });
    await db.auctionBidders.deleteMany({ where: { auction: { auctionUuid: { in: ids } } } });
    await db.auctionImages.deleteMany({ where: { auction: { auctionUuid: { in: ids } } } });
    await db.auctions.deleteMany({ where: { auctionUuid: { in: ids }, sellerUuid: owner } });
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
        sellerUuid: owner,
        title: prefix,
        description: 'original',
        minimumBid: 1000n,
        currentBid: 0n,
        startAt: new Date('2097-01-01T00:00:00Z'),
        endAt: new Date('2097-01-02T00:00:00Z'),
        status: 'visible',
        isDirectDeal: false,
        productCondition: 'used',
        thumbnailKey: 'owned-original.png',
        ...patch,
      },
    });
  }
  async function noWrites(id: string) {
    expect(await db.auctionSellerAction.count({ where: { auctionUuid: id } })).toBe(0);
    expect(await db.outbox.count({ where: { aggregateId: id } })).toBe(0);
  }
  it('keeps owner detail private including hidden history and exact decimal money', async () => {
    const row = await auction({ minimumBid: 9007199254740993n });
    expect((await adapter.read(owner, row.auctionUuid))?.minimumBid).toBe('9007199254740993');
    expect(await adapter.read(randomUUID(), row.auctionUuid)).toBeNull();
    await expect(
      adapter.change(randomUUID(), row.auctionUuid, parseSellerAuctionChange(input(), 'update')),
    ).rejects.toMatchObject({ status: 404 });
    await db.auctions.update({ where: { auctionUuid: row.auctionUuid }, data: { status: 'hidden' } });
    expect(await adapter.read(owner, row.auctionUuid)).toMatchObject({ editable: false, status: 'hidden' });
    await db.auctions.update({ where: { auctionUuid: row.auctionUuid }, data: { deletedAt: new Date() } });
    expect(await adapter.read(owner, row.auctionUuid)).toBeNull();
    await noWrites(row.auctionUuid);
  });
  it('commits five fields, version, immutable before/after and normal update Outbox together', async () => {
    const row = await auction();
    await db.auctionImages.create({ data: { auctionId: row.auctionId, key: 'owned-original.png', order: 0 } });
    await adapter.change(owner, row.auctionUuid, parseSellerAuctionChange(input(), 'update'));
    const saved = await db.auctions.findUniqueOrThrow({ where: { auctionUuid: row.auctionUuid } });
    expect(saved).toMatchObject({
      title: '변경한 판매자 테스트 경매',
      description: '변경한 설명',
      minimumBid: 2500n,
      version: 1,
      status: 'visible',
      deletedAt: null,
      thumbnailKey: 'owned-original.png',
      sellerUuid: owner,
      currentBid: 0n,
    });
    const actions = await db.auctionSellerAction.findMany({ where: { auctionUuid: row.auctionUuid } });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      action: 'update',
      sellerUuid: owner,
      reasonCode: null,
      beforeSnapshot: { title: prefix, minimumBid: '1000' },
      afterSnapshot: { title: '변경한 판매자 테스트 경매', minimumBid: '2500' },
    });
    const events = await db.outbox.findMany({ where: { aggregateId: row.auctionUuid } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      op: 'u',
      eventType: 'AuctionUpdated',
      payload: { title: '변경한 판매자 테스트 경매', minimumBid: 2500 },
    });
    expect(await db.auctionImages.count({ where: { auctionId: row.auctionId } })).toBe(1);
  });
  it('cancels without deleting data and publishes the existing search deletion event', async () => {
    const row = await auction();
    await adapter.change(
      owner,
      row.auctionUuid,
      parseSellerAuctionChange({ version: 0, reasonCode: 'other', reasonDetail: '판매 불가' }, 'cancel'),
    );
    expect(await db.auctions.findUnique({ where: { auctionUuid: row.auctionUuid } })).toMatchObject({
      status: 'cancelled',
      deletedAt: null,
      title: prefix,
      version: 1,
    });
    expect(await adapter.read(owner, row.auctionUuid)).toMatchObject({
      editable: false,
      status: 'cancelled',
      history: [
        {
          action: 'cancel',
          reasonCode: 'other',
          reasonDetail: '판매 불가',
          before: { status: 'visible' },
          after: { status: 'cancelled' },
        },
      ],
    });
    expect(await db.outbox.findFirst({ where: { aggregateId: row.auctionUuid } })).toMatchObject({
      op: 'd',
      eventType: 'AuctionDeleted',
    });
    await expect(
      adapter.change(
        owner,
        row.auctionUuid,
        parseSellerAuctionChange({ version: 1, reasonCode: 'listing_error' }, 'cancel'),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.auctionSellerAction.count({ where: { auctionUuid: row.auctionUuid } })).toBe(1);
  });
  it.each([
    'started',
    'ended',
    'hidden',
    'cancelled',
    'sold',
    'checkout',
    'bid-record',
    'deleted-bid-record',
    'current-bid',
    'current-bidder',
    'purchase',
  ] as const)('rejects protected %s rows without mutation/history/Outbox', async (state) => {
    const patch: Partial<Prisma.AuctionsUncheckedCreateInput> = {};
    if (state === 'started') patch.startAt = new Date('2020-01-01Z');
    if (state === 'ended') patch.endAt = new Date('2020-01-01Z');
    if (state === 'hidden' || state === 'cancelled') patch.status = state;
    if (state === 'sold') patch.soldAt = new Date();
    if (state === 'checkout') patch.checkoutLockedAt = new Date();
    if (state === 'current-bid') patch.currentBid = 1n;
    if (state === 'current-bidder') patch.currentBidderUuid = randomUUID();
    const row = await auction(patch);
    if (state.includes('bid-record'))
      await db.auctionBidders.create({
        data: {
          auctionId: row.auctionId,
          bidderUuid: randomUUID(),
          bidAmount: 2000n,
          deletedAt: state === 'deleted-bid-record' ? new Date() : null,
        },
      });
    if (state === 'purchase')
      await db.auctionPurchase.create({
        data: {
          auctionUuid: row.auctionUuid,
          buyerUuid: randomUUID(),
          sellerUuid: owner,
          amount: 1000n,
          orderName: 'fixture',
          customerKey: randomUUID(),
        },
      });
    await expect(
      adapter.change(owner, row.auctionUuid, parseSellerAuctionChange(input(), 'update')),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      adapter.change(
        owner,
        row.auctionUuid,
        parseSellerAuctionChange({ version: 0, reasonCode: 'listing_error' }, 'cancel'),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect((await db.auctions.findUniqueOrThrow({ where: { auctionUuid: row.auctionUuid } })).version).toBe(0);
    await noWrites(row.auctionUuid);
  });
  it('serializes same-version edit/cancel and commits only one history/event', async () => {
    const row = await auction();
    const results = await Promise.allSettled([
      adapter.change(owner, row.auctionUuid, parseSellerAuctionChange(input(), 'update')),
      adapter.change(
        owner,
        row.auctionUuid,
        parseSellerAuctionChange({ version: 0, reasonCode: 'listing_error' }, 'cancel'),
      ),
    ]);
    expect(results.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((value) => value.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
    expect(await db.auctionSellerAction.count({ where: { auctionUuid: row.auctionUuid } })).toBe(1);
    expect(await db.outbox.count({ where: { aggregateId: row.auctionUuid } })).toBe(1);
  });
  it('rolls back auction and history if Outbox preparation fails', async () => {
    const row = await auction();
    const { SellerAuctionPrismaAdapter: Adapter } = await import('./seller-auction-prisma.adapter');
    const broken = new Adapter(db as PrismaService, media, {
      resolveNames: async () => {
        throw new Error('Taxonomy fixture unavailable');
      },
    } as unknown as TaxonomyUseCase);
    await expect(broken.change(owner, row.auctionUuid, parseSellerAuctionChange(input(), 'update'))).rejects.toThrow(
      'Taxonomy fixture unavailable',
    );
    expect(await db.auctions.findUnique({ where: { auctionUuid: row.auctionUuid } })).toMatchObject({
      title: prefix,
      version: 0,
    });
    await noWrites(row.auctionUuid);
  });
  it.each(['update', 'cancel'] as const)(
    'rejects %s after the start passes while waiting for a real row lock',
    async (action) => {
      const [clock] = await db.$queryRaw<
        Array<{ start: Date }>
      >`SELECT clock_timestamp()+interval '2 seconds' AS start`;
      const row = await auction({ startAt: clock.start });
      let unlock!: () => void;
      let acquired!: () => void;
      const gate = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      const locked = new Promise<void>((resolve) => {
        acquired = resolve;
      });
      const holder = db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "auctionUuid" FROM "Auctions" WHERE "auctionUuid"=${row.auctionUuid}::uuid FOR UPDATE`;
          acquired();
          await gate;
        },
        { timeout: 7000 },
      );
      await locked;
      const command =
        action === 'update'
          ? parseSellerAuctionChange(input(), 'update')
          : parseSellerAuctionChange({ version: 0, reasonCode: 'listing_error' }, 'cancel');
      const pending = adapter.change(owner, row.auctionUuid, command).then(
        () => ({ status: 200 }),
        (error) => ({ status: error.status }),
      );
      try {
        await expect
          .poll(
            async () => {
              const [result] = await db.$queryRaw<
                Array<{ waiting: number }>
              >`SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%"sellerUuid"%FOR UPDATE%'`;
              return result.waiting;
            },
            { timeout: 1500 },
          )
          .toBeGreaterThan(0);
        await db.$executeRaw`SELECT pg_sleep(2.1)`;
      } finally {
        unlock();
        await holder;
      }
      expect(await pending).toEqual({ status: 409 });
      expect((await db.auctions.findUniqueOrThrow({ where: { auctionUuid: row.auctionUuid } })).version).toBe(0);
      await noWrites(row.auctionUuid);
    },
  );
});
