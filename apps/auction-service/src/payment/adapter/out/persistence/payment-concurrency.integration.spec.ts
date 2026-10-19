import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../../../prisma/generated';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AuctionPrismaAdapter } from '../../../../auction/adapter/out/postgresql/auction-prisma.adapter';
import NewBid from '../../../../auction/domain/model/new-bid';
import { PaymentService } from '../../../application/service/payment.service';
import { PaymentPrismaAdapter } from './payment-prisma.adapter';
import { PaymentAdminPrismaAdapter } from './payment-admin-prisma.adapter';
import { PaymentAdminService } from '../../../application/service/payment-admin.service';
import { FakePaymentProvider, buyerUuid, sellerUuid } from '../../../payment.test-fixtures';
import { requireTestDatabaseUrl } from '../../../../../../../scripts/test-database.mjs';

const url = process.env.TEST_DATABASE_URL ? requireTestDatabaseUrl(process.env.TEST_DATABASE_URL) : undefined;

describe.skipIf(!url)('payment concurrency on isolated PostgreSQL', () => {
  const database = url ? new PrismaClient({ datasources: { db: { url } } }) : undefined!;
  const bidUrl = url ? new URL(url) : undefined;
  bidUrl?.searchParams.set('connection_limit', '1');
  const bidder = bidUrl ? new PrismaClient({ datasources: { db: { url: bidUrl.toString() } } }) : undefined!;
  const store = new PaymentPrismaAdapter(database as PrismaService);
  const repository = new AuctionPrismaAdapter(
    bidder as PrismaService,
    { toFullUrl: (key: string) => `https://fixture.invalid/${key}` } as never,
    { resolveNames: async () => ({ categoryName: null, tagNames: [] }) } as never,
  );
  let uuid: string;
  let provider: FakePaymentProvider;
  let service: PaymentService;
  let extraUuids: string[];

  beforeAll(async () => {
    await database.$connect();
    await bidder.$connect();
  });
  beforeEach(async () => {
    uuid = randomUUID();
    extraUuids = [];
    provider = new FakePaymentProvider();
    service = new PaymentService(
      store,
      provider,
      new ConfigService({ TOSS_PAYMENTS_ENABLED: true, TOSS_CLIENT_KEY: 'test_gck_fixture' }),
    );
    const hour = Math.floor(Date.now() / 3600000) * 3600000;
    await database.auctions.create({
      data: {
        auctionUuid: uuid,
        title: 'Concurrency test auction',
        description: 'Isolated test fixture',
        minimumBid: 10000n,
        currentBid: 15000n,
        currentBidderUuid: buyerUuid,
        sellerUuid,
        startAt: new Date(hour - 7200000),
        endAt: new Date(hour - 3600000),
        isDirectDeal: false,
        status: 'visible',
        productCondition: 'used',
        thumbnailKey: 'test.webp',
      },
    });
  });
  afterEach(async () => {
    const fixtures = [uuid, ...extraUuids];
    await database.auctionPaymentAttempt.deleteMany({ where: { purchase: { auctionUuid: { in: fixtures } } } });
    await database.auctionPurchase.deleteMany({ where: { auctionUuid: { in: fixtures } } });
    await database.auctionBidders.deleteMany({ where: { auction: { auctionUuid: uuid } } });
    await database.outbox.deleteMany({ where: { aggregateId: uuid } });
    await database.auctions.deleteMany({ where: { auctionUuid: { in: fixtures } } });
  });
  afterAll(async () => {
    await bidder.$disconnect();
    await database.$disconnect();
  });

  it('serializes simultaneous preparations into one purchase and attempt', async () => {
    const views = await Promise.all(Array.from({ length: 8 }, () => service.prepare(uuid, buyerUuid)));
    expect(new Set(views.map((view) => view.purchase!.purchaseUuid)).size).toBe(1);
    expect(new Set(views.map((view) => view.purchase!.attempt!.orderId)).size).toBe(1);
    expect(await database.auctionPurchase.count({ where: { auctionUuid: uuid } })).toBe(1);
    expect((await store.read(uuid)).purchase!.attempts).toHaveLength(1);
  });

  it('lists eligible wins without creating purchases and excludes unavailable or invalid wins', async () => {
    const query = new PaymentAdminPrismaAdapter(database as PrismaService);
    const title = `Unstarted ${uuid}`;
    await database.auctions.update({
      where: { auctionUuid: uuid },
      data: { title, endAt: new Date('2026-10-18T00:00:00Z') },
    });
    const policy = { dueHours: 24, soonHours: 6, asOf: '2026-10-19T00:00:00Z' };
    expect(await query.find({ query: title }, policy)).toHaveLength(0);
    expect(await query.find({ query: title, includeUnstarted: false }, policy)).toHaveLength(0);
    expect(
      await query.find({ query: title, includeUnstarted: true, status: 'NOT_STARTED', attention: 'OVERDUE' }, policy),
    ).toMatchObject([
      {
        purchaseUuid: null,
        auctionUuid: uuid,
        buyerUuid,
        amount: 15000n,
        status: 'NOT_STARTED',
        createdAt: '2026-10-18T00:00:00.000000Z',
        reviewDueAt: '2026-10-19T00:00:00.000000Z',
        attemptOrderId: null,
      },
    ]);
    for (const invalid of [
      { status: 'hidden' as const },
      { status: 'cancelled' as const },
      { deletedAt: new Date() },
      { soldAt: new Date() },
      { endAt: new Date('2026-10-20T00:00:00Z') },
      { currentBidderUuid: null },
      { currentBidderUuid: '' },
      { currentBidderUuid: sellerUuid },
      { currentBid: 0n },
      { currentBid: 9007199254740992n },
    ]) {
      await database.auctions.update({
        where: { auctionUuid: uuid },
        data: {
          status: 'visible',
          deletedAt: null,
          soldAt: null,
          endAt: new Date('2026-10-18T00:00:00Z'),
          currentBidderUuid: buyerUuid,
          currentBid: 15000n,
          ...invalid,
        },
      });
      expect(await query.find({ query: title, includeUnstarted: true }, policy)).toHaveLength(0);
    }
    expect(await database.auctionPurchase.count({ where: { auctionUuid: uuid } })).toBe(0);
    expect(provider.confirms).toHaveLength(0);
    expect(provider.cancels).toHaveLength(0);
  });

  it('replaces the unstarted projection with the actual purchase without duplicating a canceled win', async () => {
    const listing = new PaymentAdminService(new PaymentAdminPrismaAdapter(database as PrismaService));
    const title = `Transition ${uuid}`;
    await database.auctions.update({ where: { auctionUuid: uuid }, data: { title } });
    expect((await listing.list({ query: title, includeUnstarted: true })).items).toMatchObject([
      { purchaseUuid: null, status: 'NOT_STARTED' },
    ]);
    const prepared = await service.prepare(uuid, buyerUuid);
    expect((await listing.list({ query: title, includeUnstarted: true })).items).toMatchObject([
      { purchaseUuid: prepared.purchase!.purchaseUuid, status: 'AWAITING_PAYMENT' },
    ]);
    expect((await listing.list({ query: title, includeUnstarted: true, status: 'NOT_STARTED' })).items).toHaveLength(0);
    await database.auctionPurchase.update({ where: { auctionUuid: uuid }, data: { status: 'CANCELED' } });
    expect((await listing.list({ query: title, includeUnstarted: true })).items).toMatchObject([
      { status: 'CANCELED', attention: 'NONE' },
    ]);
    expect((await listing.list({ query: title, includeUnstarted: true, status: 'NOT_STARTED' })).items).toHaveLength(0);
  });

  it('paginates mixed unstarted and existing orders at tied microsecond timestamps', async () => {
    const title = randomUUID();
    extraUuids = Array.from({ length: 44 }, () => randomUUID()).sort();
    await database.auctions.createMany({
      data: extraUuids.map((auctionUuid) => ({
        auctionUuid,
        title,
        description: 'Mixed listing fixture',
        minimumBid: 10000n,
        currentBid: 15000n,
        currentBidderUuid: buyerUuid,
        sellerUuid,
        startAt: new Date('2026-10-16T00:00:00Z'),
        endAt: new Date('2026-10-18T00:00:00Z'),
        isDirectDeal: false,
        status: 'visible',
        productCondition: 'used',
        thumbnailKey: 'test.webp',
      })),
    });
    await database.auctionPurchase.createMany({
      data: extraUuids
        .filter((_, index) => index % 2 === 0)
        .map((auctionUuid) => ({
          auctionUuid,
          buyerUuid,
          sellerUuid,
          amount: 15000n,
          orderName: title,
          customerKey: randomUUID(),
          createdAt: new Date('2026-10-18T00:00:00Z'),
        })),
    });
    await database.$executeRaw`UPDATE "Auctions" SET "endAt" = '2026-10-18T00:00:00.123456Z'::timestamptz WHERE "title" = ${title}`;
    await database.$executeRaw`UPDATE "AuctionPurchase" SET "createdAt" = '2026-10-18T00:00:00.123456Z'::timestamptz WHERE "orderName" = ${title}`;
    const listing = new PaymentAdminService(new PaymentAdminPrismaAdapter(database as PrismaService));
    const first = await listing.list({ query: title, includeUnstarted: true });
    const second = await listing.list({ query: title, includeUnstarted: true, cursor: first.nextCursor! });
    const third = await listing.list({ query: title, includeUnstarted: true, cursor: second.nextCursor! });
    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(20);
    expect(third.items).toHaveLength(4);
    expect(third.nextCursor).toBeNull();
    expect([...first.items, ...second.items, ...third.items].map((row) => row.auctionUuid)).toEqual(
      [...extraUuids].reverse(),
    );
    expect(first.nextCursor).toEqual({
      createdAt: '2026-10-18T00:00:00.123456Z',
      purchaseUuid: first.items[19].purchaseUuid,
    });
    const unstarted = await listing.list({ query: title, includeUnstarted: true, status: 'NOT_STARTED' });
    const rest = await listing.list({
      query: title,
      includeUnstarted: true,
      status: 'NOT_STARTED',
      cursor: unstarted.nextCursor!,
    });
    expect(unstarted.nextCursor).toEqual({
      createdAt: '2026-10-18T00:00:00.123456Z',
      auctionUuid: unstarted.items[19].auctionUuid,
    });
    expect([...unstarted.items, ...rest.items]).toHaveLength(22);
    expect(new Set([...unstarted.items, ...rest.items].map((row) => row.auctionUuid)).size).toBe(22);
    expect(provider.confirms).toHaveLength(0);
    expect(provider.cancels).toHaveLength(0);
  });

  it('lists persisted orders with literal search, latest attempt and lossless microsecond boundaries', async () => {
    const prepared = await service.prepare(uuid, buyerUuid);
    const purchaseUuid = prepared.purchase!.purchaseUuid;
    const firstOrder = prepared.purchase!.attempt!.orderId;
    const title = `Literal%_\\ listing ${uuid}`;
    await database.auctionPurchase.update({
      where: { purchaseUuid },
      data: { orderName: title, amount: 9007199254740993n, status: 'PAID' },
    });
    await database.$executeRaw`
      UPDATE "AuctionPurchase" SET "createdAt" = '2026-10-18T14:00:00.123456Z'::timestamptz
      WHERE "purchaseUuid" = ${purchaseUuid}::uuid`;
    await database.auctionPaymentAttempt.create({
      data: {
        orderId: `latest_${randomUUID()}`,
        purchaseUuid,
        attemptNumber: 2,
        status: 'DONE',
        method: 'CARD',
        confirmIdempotencyKey: randomUUID(),
        cancelIdempotencyKey: randomUUID(),
      },
    });
    const query = new PaymentAdminService(new PaymentAdminPrismaAdapter(database as PrismaService));
    const result = await query.list({
      query: uuid,
      status: 'PAID',
      from: '2026-10-18T14:00:00.123456Z',
      to: '2026-10-18T14:00:00.123457Z',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      purchaseUuid,
      orderName: title,
      amount: '9007199254740993',
      createdAt: '2026-10-18T14:00:00.123456Z',
      attempt: { status: 'DONE', method: 'CARD' },
    });
    expect(result.items[0].attempt!.orderId).not.toBe(firstOrder);
    expect((await query.list({ query: firstOrder })).items[0].purchaseUuid).toBe(purchaseUuid);
    expect((await query.list({ query: `%_\\ listing ${uuid}` })).items).toHaveLength(1);
    expect((await query.list({ query: `wrong%${uuid}` })).items).toHaveLength(0);
    expect((await query.list({ query: uuid, status: 'CANCELED' })).items).toHaveLength(0);
    expect((await query.list({ query: uuid, to: '2026-10-18T14:00:00.123456Z' })).items).toHaveLength(0);
    expect(
      (await query.list({ query: uuid, cursor: { createdAt: '2026-10-18T14:00:00.123456Z', purchaseUuid } })).items,
    ).toHaveLength(0);
    expect(JSON.stringify(result)).not.toMatch(/customerKey|paymentKey|Idempotency|operationLease/);
  });

  it('rejects a bid that waits on the checkout row lock', async () => {
    await database.auctions.update({ where: { auctionUuid: uuid }, data: { endAt: new Date(Date.now() + 3600000) } });
    const [{ pid }] = await bidder.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
    let release!: () => void;
    let locked!: () => void;
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const checkout = store.locked(uuid, async (state) => {
      state.auction.checkoutLockedAt = new Date();
      locked();
      await gate;
    });
    await acquired;
    const bid = repository.updateAuctionCurrentBid(uuid, 16000n, randomUUID());
    try {
      const deadline = Date.now() + 3000;
      let waiting = false;
      while (!waiting && Date.now() < deadline) {
        const [row] = await database.$queryRaw<Array<{ waiting: boolean }>>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = ${pid} AND wait_event_type = 'Lock') AS waiting`;
        waiting = row.waiting;
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
    } finally {
      release();
      await checkout;
      await bid;
    }
    expect(await bid).toBe(0);
    expect((await store.read(uuid)).auction.currentBid).toBe(15000n);
    expect(await database.outbox.count({ where: { aggregateId: uuid } })).toBe(0);
  });

  it('coalesces duplicate confirmations without another attempt or provider action', async () => {
    const prepared = await service.prepare(uuid, buyerUuid);
    const body = { orderId: prepared.purchase!.attempt!.orderId, paymentKey: `test_${randomUUID()}`, amount: '15000' };
    await Promise.all(Array.from({ length: 6 }, () => service.confirm(uuid, buyerUuid, body)));
    expect(provider.confirms).toHaveLength(1);
    expect((await store.read(uuid)).purchase).toMatchObject({
      status: 'PAID',
      attempts: [expect.objectContaining({ status: 'DONE' })],
    });
  });

  it('reclaims an expired operation lease with the persisted idempotency key', async () => {
    await service.prepare(uuid, buyerUuid);
    await store.locked(uuid, async (state) => {
      const attempt = state.purchase!.attempts[0];
      attempt.paymentKey = `test_${randomUUID()}`;
      attempt.status = 'CONFIRMING';
      attempt.confirmRequestedAt = new Date();
      attempt.operationLeaseUntil = new Date(Date.now() - 1000);
      attempt.operationLeaseToken = randomUUID();
    });
    const original = (await store.read(uuid)).purchase!.attempts[0];
    await Promise.all(Array.from({ length: 4 }, () => service.reconcile(uuid, buyerUuid)));
    expect(provider.confirms).toHaveLength(1);
    expect(provider.confirms[0]).toMatchObject({
      key: original.confirmIdempotencyKey,
      orderId: original.orderId,
      amount: 15000,
    });
    expect((await store.read(uuid)).purchase!.attempts).toHaveLength(1);
  });

  it('rolls back checkout changes and all bid capabilities when callbacks fail', async () => {
    await expect(
      store.locked(uuid, async (state) => {
        state.auction.checkoutLockedAt = new Date();
        throw new Error('abort checkout');
      }),
    ).rejects.toThrow('abort checkout');
    expect((await store.read(uuid)).auction.checkoutLockedAt).toBeNull();
    await database.auctions.update({
      where: { auctionUuid: uuid },
      data: {
        endAt: new Date(Math.ceil(Date.now() / 3600000) * 3600000),
      },
    });
    await expect(
      repository.withLockedAuction(uuid, async (session) => {
        const auction = session.auction.getSnapshot();
        await session.createBid(
          new NewBid(
            {
              auctionId: auction.auctionId,
              bidAmount: 16000n,
              currentBid: 15000n,
              currentBidAmount: 15000n,
              sellerUuid,
            },
            { memberUuid: buyerUuid, role: 'member' },
          ),
        );
        expect(await session.updateCurrentBid(16000n, buyerUuid)).toBe(1);
        throw new Error('abort bid');
      }),
    ).rejects.toThrow('abort bid');
    expect(await database.auctionBidders.count({ where: { auction: { auctionUuid: uuid } } })).toBe(0);
    expect(await database.outbox.count({ where: { aggregateId: uuid } })).toBe(0);
    expect((await store.read(uuid)).auction.currentBid).toBe(15000n);
  });

  it('classifies advisory deadlines at microsecond boundaries and keeps uncertain paid cancellations in review', async () => {
    const prepared = await service.prepare(uuid, buyerUuid);
    const orderId = prepared.purchase!.attempt!.orderId;
    const query = new PaymentAdminPrismaAdapter(database as PrismaService);
    const policy = { dueHours: 24, soonHours: 6, asOf: '2026-10-19T00:00:00Z' };
    for (const [endAt, attention, reviewDueAt] of [
      ['2026-10-18T06:00:00.000001Z', 'WAITING', '2026-10-19T06:00:00.000001Z'],
      ['2026-10-18T06:00:00.000000Z', 'DUE_SOON', '2026-10-19T06:00:00.000000Z'],
      ['2026-10-18T00:00:00.000001Z', 'DUE_SOON', '2026-10-19T00:00:00.000001Z'],
      ['2026-10-18T00:00:00.000000Z', 'OVERDUE', '2026-10-19T00:00:00.000000Z'],
      ['2026-10-17T00:00:00.000000Z', 'OVERDUE', '2026-10-18T00:00:00.000000Z'],
    ] as const) {
      await database.$executeRaw`UPDATE "Auctions" SET "endAt" = ${endAt}::timestamptz WHERE "auctionUuid" = ${uuid}::uuid`;
      const [row] = await query.find({ query: orderId, attention }, policy);
      expect(row).toMatchObject({ attention, reviewDueAt });
      expect(
        await query.find({ query: orderId, attention: attention === 'OVERDUE' ? 'WAITING' : 'OVERDUE' }, policy),
      ).toHaveLength(0);
    }
    await database.auctionPurchase.update({ where: { auctionUuid: uuid }, data: { status: 'PAID' } });
    await database.auctionPaymentAttempt.update({ where: { orderId }, data: { status: 'CANCELING' } });
    expect(await query.find({ query: orderId, attention: 'REVIEW_REQUIRED' }, policy)).toHaveLength(1);
    expect(await query.find({ query: orderId, attention: 'OVERDUE' }, policy)).toHaveLength(0);
    await database.auctionPaymentAttempt.update({
      where: { orderId },
      data: { status: 'DONE', errorCode: 'PROVIDER_MISMATCH' },
    });
    expect(await query.find({ query: orderId, attention: 'REVIEW_REQUIRED' }, policy)).toHaveLength(1);
    await database.auctionPurchase.update({ where: { auctionUuid: uuid }, data: { status: 'CANCELED' } });
    expect(await query.find({ query: orderId, attention: 'REVIEW_REQUIRED' }, policy)).toHaveLength(0);
    expect((await query.find({ query: orderId }, policy))[0].attention).toBe('NONE');
    expect(provider.confirms).toHaveLength(0);
    expect(provider.cancels).toHaveLength(0);
  });

  it('paginates filtered orders before the lookahead with interleaved states and tied timestamps', async () => {
    const group = randomUUID();
    const prefix = randomUUID().slice(0, 24);
    const rows = Array.from({ length: 44 }, (_, index) => ({
      uuid: prefix + String(index).padStart(12, '0'),
      overdue: index % 2 === 0,
      endAt: new Date(index % 2 === 0 ? '2026-10-17T00:00:00Z' : '2026-10-19T00:00:00Z'),
    }));
    extraUuids = rows.map((row) => row.uuid);
    await database.auctions.createMany({
      data: rows.map((row) => ({
        auctionUuid: row.uuid,
        title: group,
        description: 'Isolated pagination fixture',
        minimumBid: 10000n,
        currentBid: 15000n,
        currentBidderUuid: buyerUuid,
        sellerUuid,
        startAt: new Date('2026-10-16T00:00:00Z'),
        endAt: row.endAt,
        isDirectDeal: false,
        status: 'visible',
        productCondition: 'used',
        thumbnailKey: 'test.webp',
      })),
    });
    await database.auctionPurchase.createMany({
      data: rows.map((row) => ({
        purchaseUuid: row.uuid,
        auctionUuid: row.uuid,
        buyerUuid,
        sellerUuid,
        amount: 15000n,
        orderName: group,
        customerKey: randomUUID(),
        status: 'AWAITING_PAYMENT',
        createdAt: new Date('2026-10-18T00:00:00Z'),
      })),
    });
    await database.auctionPaymentAttempt.createMany({
      data: rows.map((row) => ({
        purchaseUuid: row.uuid,
        orderId: `order_${row.uuid}`,
        attemptNumber: 1,
        status: 'READY',
        confirmIdempotencyKey: randomUUID(),
        cancelIdempotencyKey: randomUUID(),
      })),
    });
    const adapter = new PaymentAdminPrismaAdapter(database as PrismaService);
    const listing = new PaymentAdminService({
      find: (command, policy) =>
        adapter.find(command, {
          ...policy,
          asOf: '2026-10-19T00:00:00Z',
        }),
    });
    const first = await listing.list({ query: group, attention: 'OVERDUE' });
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    const second = await listing.list({ query: group, attention: 'OVERDUE', cursor: first.nextCursor! });
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    expect([...first.items, ...second.items].map((row) => row.purchaseUuid)).toEqual(
      rows
        .filter((row) => row.overdue)
        .reverse()
        .map((row) => row.uuid),
    );
    expect([...first.items, ...second.items].every((row) => row.attention === 'OVERDUE')).toBe(true);
    expect(provider.confirms).toHaveLength(0);
    expect(provider.cancels).toHaveLength(0);
  });

  it('returns the persisted original cancellation reason in the administrator list', async () => {
    const prepared = await service.prepare(uuid, buyerUuid);
    const orderId = prepared.purchase!.attempt!.orderId;
    await service.confirm(uuid, buyerUuid, { orderId, paymentKey: `test_${randomUUID()}`, amount: '15000' });
    await service.cancel(uuid, 'first-operator', 'Legacy handwritten cancellation');
    await service.cancel(uuid, 'later-operator', 'Different reason on retry');
    const listing = new PaymentAdminService(new PaymentAdminPrismaAdapter(database as PrismaService));
    const [row] = (await listing.list({ query: orderId })).items;
    expect(row.attempt).toMatchObject({ status: 'CANCELED', cancelReason: 'Legacy handwritten cancellation' });
    expect(provider.cancels).toHaveLength(1);
    expect(JSON.stringify(row)).not.toMatch(/paymentKey|Idempotency|customerKey/);
  });
});
