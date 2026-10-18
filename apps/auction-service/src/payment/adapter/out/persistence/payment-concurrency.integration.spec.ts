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

  beforeAll(async () => {
    await database.$connect();
    await bidder.$connect();
  });
  beforeEach(async () => {
    uuid = randomUUID();
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
    await database.auctionPaymentAttempt.deleteMany({ where: { purchase: { auctionUuid: uuid } } });
    await database.auctionPurchase.deleteMany({ where: { auctionUuid: uuid } });
    await database.auctionBidders.deleteMany({ where: { auction: { auctionUuid: uuid } } });
    await database.outbox.deleteMany({ where: { aggregateId: uuid } });
    await database.auctions.deleteMany({ where: { auctionUuid: uuid } });
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
});
