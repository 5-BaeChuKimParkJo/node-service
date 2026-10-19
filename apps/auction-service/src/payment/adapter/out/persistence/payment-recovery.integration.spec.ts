import { randomUUID } from 'node:crypto';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as jwt from 'jsonwebtoken';
import { BigIntToNumberInterceptor } from '@app/common/middleware/bigint-to-number.middleware';
import { ZodExceptionFilter } from '@app/common/filter/zod-exception.filter';
import { PrismaClient } from '../../../../prisma/generated';
import { PrismaService } from '../../../../prisma/prisma.service';
import { InternalAdminTokenGuard } from '../../../../auction/adapter/in/web/internal-admin-token.guard';
import { PaymentController, AdminPaymentController, TossWebhookController } from '../../in/web/payment.controller';
import { CheckoutView, PaymentService } from '../../../application/service/payment.service';
import { PaymentStorePort } from '../../../application/port/out/payment-store.port';
import { PaymentProviderPort } from '../../../application/port/out/payment-provider.port';
import { PaymentPrismaAdapter } from './payment-prisma.adapter';
import { FakePaymentProvider, buyerUuid, sellerUuid } from '../../../payment.test-fixtures';
import { requireTestDatabaseUrl } from '../../../../../../../scripts/test-database.mjs';

const url = process.env.TEST_DATABASE_URL ? requireTestDatabaseUrl(process.env.TEST_DATABASE_URL) : undefined;

function gate() {
  let release!: () => void;
  let enter!: () => void;
  const entered = new Promise<void>((resolve) => (enter = resolve));
  const waiting = new Promise<void>((resolve) => (release = resolve));
  return { entered, waiting, enter, release };
}

async function bounded<T>(pending: Promise<T>): Promise<T> {
  let timer!: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Payment concurrency gate timed out')), 3000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe.skipIf(!url)('payment HTTP recovery on isolated PostgreSQL', () => {
  const database = url ? new PrismaClient({ datasources: { db: { url } } }) : undefined!;
  const instances: Array<{ app: NestFastifyApplication; client: PrismaClient }> = [];
  const secret = 'payment-recovery-test-secret-at-least-32';
  const token = 'payment-recovery-internal-test-token';
  const auth = () => ({
    authorization:
      'Bearer ' +
      jwt.sign({ memberUuid: buyerUuid, role: 'user', token_type: 'access' }, secret, {
        issuer: 'cn-account',
      }),
  });
  const admin = { 'x-admin-internal-token': token, 'x-admin-actor': 'first-operator' };
  let uuid: string;
  let path: string;
  let adminPath: string;
  let provider: FakePaymentProvider;
  let app: NestFastifyApplication;

  async function start() {
    const client = new PrismaClient({ datasources: { db: { url } } });
    const module = await Test.createTestingModule({
      controllers: [PaymentController, AdminPaymentController, TossWebhookController],
      providers: [
        PaymentService,
        PaymentPrismaAdapter,
        InternalAdminTokenGuard,
        { provide: PrismaService, useValue: client },
        { provide: PaymentStorePort, useExisting: PaymentPrismaAdapter },
        { provide: PaymentProviderPort, useValue: provider },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            ADMIN_INTERNAL_TOKEN: token,
            TOSS_PAYMENTS_ENABLED: true,
            TOSS_CLIENT_KEY: 'test_gck_fixture',
          }),
        },
      ],
    }).compile();
    const instance = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    instances.push({ app: instance, client });
    instance.setGlobalPrefix('api');
    instance.enableVersioning({ type: VersioningType.URI });
    instance.useGlobalInterceptors(new BigIntToNumberInterceptor());
    instance.useGlobalFilters(new ZodExceptionFilter());
    await instance.init();
    await instance.getHttpAdapter().getInstance().ready();
    return instance;
  }

  async function stop() {
    for (const instance of instances.splice(0)) {
      try {
        await instance.app.close();
      } finally {
        await instance.client.$disconnect();
      }
    }
  }

  async function post(
    instance: NestFastifyApplication,
    target: string,
    payload = {},
    headers: Record<string, string> = auth(),
  ) {
    const response = await instance.inject({ method: 'POST', url: target, payload, headers });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<CheckoutView>();
  }

  async function prepare() {
    const result = await post(app, path);
    return { orderId: result.purchase!.attempt!.orderId, paymentKey: `test_${randomUUID()}`, amount: '15000' };
  }

  function persisted() {
    return database.auctionPurchase.findUniqueOrThrow({
      where: { auctionUuid: uuid },
      include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
    });
  }

  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', secret);
    await database.$connect();
  });
  beforeEach(async () => {
    uuid = randomUUID();
    path = `/api/v1/auctions/${uuid}/checkout`;
    adminPath = `/api/v1/internal/admin/auctions/${uuid}/payment`;
    provider = new FakePaymentProvider();
    await database.auctions.create({
      data: {
        auctionUuid: uuid,
        title: 'HTTP recovery test auction',
        description: 'Isolated test fixture',
        minimumBid: 10000n,
        currentBid: 15000n,
        currentBidderUuid: buyerUuid,
        sellerUuid,
        startAt: new Date(Date.now() - 7200000),
        endAt: new Date(Date.now() - 3600000),
        isDirectDeal: false,
        status: 'visible',
        productCondition: 'used',
        thumbnailKey: 'test.webp',
      },
    });
    app = await start();
  });
  afterEach(async () => {
    await stop();
    vi.restoreAllMocks();
    await database.auctionPaymentAttempt.deleteMany({ where: { purchase: { auctionUuid: uuid } } });
    await database.auctionPurchase.deleteMany({ where: { auctionUuid: uuid } });
    await database.auctions.deleteMany({ where: { auctionUuid: uuid } });
  });
  afterAll(async () => {
    await database.$disconnect();
    vi.unstubAllEnvs();
  });

  it('coalesces concurrent HTTP confirmations across independent app instances', async () => {
    const body = await prepare();
    const replica = await start();
    const blocked = gate();
    const confirm = provider.confirm.bind(provider);
    vi.spyOn(provider, 'confirm').mockImplementationOnce(async (...args) => {
      blocked.enter();
      await blocked.waiting;
      return confirm(...args);
    });
    provider.queryError = true;
    const first = post(app, path + '/confirm', body);
    let duplicates: Promise<CheckoutView[]> | undefined;
    try {
      await bounded(blocked.entered);
      duplicates = Promise.all(Array.from({ length: 5 }, () => post(replica, path + '/confirm', body)));
      await bounded(duplicates);
      const pending = await persisted();
      expect(pending.attempts).toHaveLength(1);
      expect(pending.attempts[0].operationLeaseToken).not.toBeNull();
      expect(provider.confirm).toHaveBeenCalledTimes(1);
    } finally {
      blocked.release();
      await first;
      if (duplicates) await bounded(duplicates);
    }
    expect((await first).purchase!.status).toBe('PAID');
    const final = await persisted();
    expect(final).toMatchObject({ status: 'PAID', amount: 15000n });
    expect(final.attempts).toMatchObject([{ status: 'DONE', operationLeaseToken: null, operationLeaseUntil: null }]);
    expect(provider.confirms).toHaveLength(1);
    expect(provider.confirms[0].key).toBe(final.attempts[0].confirmIdempotencyKey);
    expect(JSON.stringify(await first)).not.toMatch(/paymentKey|Idempotency|operationLease|cancellationHistory/);
  }, 15000);

  it('coalesces concurrent HTTP cancellations and preserves the first operator and reason', async () => {
    const body = await prepare();
    await post(app, path + '/confirm', body);
    const replica = await start();
    const blocked = gate();
    const cancel = provider.cancel.bind(provider);
    vi.spyOn(provider, 'cancel').mockImplementationOnce(async (...args) => {
      blocked.enter();
      await blocked.waiting;
      return cancel(...args);
    });
    const first = post(app, adminPath + '/cancel', { reason: 'First cancellation reason' }, admin);
    let duplicates: Promise<CheckoutView[]> | undefined;
    let requestedAt: Date | null = null;
    try {
      await bounded(blocked.entered);
      requestedAt = (await persisted()).attempts[0].cancelRequestedAt;
      duplicates = Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          post(
            replica,
            adminPath + '/cancel',
            { reason: 'Later cancellation reason' },
            {
              ...admin,
              'x-admin-actor': `later-operator-${index}`,
            },
          ),
        ),
      );
      await bounded(duplicates);
      expect(provider.cancel).toHaveBeenCalledTimes(1);
    } finally {
      blocked.release();
      await first;
      if (duplicates) await bounded(duplicates);
    }
    await post(replica, adminPath + '/cancel', { reason: 'Already canceled retry' }, admin);
    const final = await persisted();
    expect(final.status).toBe('CANCELED');
    expect(final.attempts).toHaveLength(1);
    expect(final.attempts[0]).toMatchObject({
      status: 'CANCELED',
      cancelActor: 'first-operator',
      cancelReason: 'First cancellation reason',
      cancelRequestedAt: requestedAt,
      operationLeaseToken: null,
    });
    expect(provider.cancels).toEqual([
      { paymentKey: body.paymentKey, reason: 'First cancellation reason', key: final.attempts[0].cancelIdempotencyKey },
    ]);
    expect((await first).cancellationHistory).toEqual([
      expect.objectContaining({ actor: 'first-operator', reason: 'First cancellation reason', status: 'CANCELED' }),
    ]);
  }, 15000);

  it.each(['confirm', 'cancel'] as const)(
    'recovers a lost %s response after restarting without replaying the action',
    async (action) => {
      const body = await prepare();
      if (action === 'cancel') await post(app, path + '/confirm', body);
      provider.loseConfirm = action === 'confirm';
      provider.loseCancel = action === 'cancel';
      provider.queryError = true;
      const uncertain =
        action === 'confirm'
          ? await post(app, path + '/confirm', body)
          : await post(app, adminPath + '/cancel', { reason: 'Original recovery reason' }, admin);
      expect(uncertain.purchase!.attempt!.status).toBe(action === 'confirm' ? 'UNKNOWN' : 'CANCELING');
      const before = await persisted();
      expect(before.attempts[0].operationLeaseToken).toBeNull();

      await stop();
      app = await start();
      provider.queryError = false;
      const recovered = await post(
        app,
        action === 'confirm' ? path + '/reconcile' : adminPath + '/reconcile',
        {},
        action === 'confirm' ? auth() : admin,
      );
      expect(recovered.purchase!.status).toBe(action === 'confirm' ? 'PAID' : 'CANCELED');
      expect(provider.confirms).toHaveLength(1);
      expect(provider.cancels).toHaveLength(action === 'confirm' ? 0 : 1);
      const after = await persisted();
      expect(after.attempts).toHaveLength(1);
      expect(after.attempts[0]).toMatchObject({
        paymentKey: body.paymentKey,
        confirmIdempotencyKey: before.attempts[0].confirmIdempotencyKey,
        cancelIdempotencyKey: before.attempts[0].cancelIdempotencyKey,
        cancelActor: before.attempts[0].cancelActor,
        cancelReason: before.attempts[0].cancelReason,
        cancelRequestedAt: before.attempts[0].cancelRequestedAt,
        errorCode: null,
      });
    },
  );

  it.each(['confirm', 'cancel'] as const)(
    'retries a %s request lost before the provider with the persisted key',
    async (action) => {
      const body = await prepare();
      if (action === 'cancel') await post(app, path + '/confirm', body);
      provider.failBeforeConfirm = action === 'confirm';
      provider.failBeforeCancel = action === 'cancel';
      provider.queryError = true;
      const uncertain =
        action === 'confirm'
          ? await post(app, path + '/confirm', body)
          : await post(app, adminPath + '/cancel', { reason: 'Original retry reason' }, admin);
      expect(uncertain.purchase!.attempt!.status).toBe(action === 'confirm' ? 'UNKNOWN' : 'CANCELING');
      const before = await persisted();
      expect(provider.payment?.status ?? null).toBe(action === 'confirm' ? null : 'DONE');

      await stop();
      app = await start();
      provider.queryError = false;
      provider.failBeforeConfirm = false;
      provider.failBeforeCancel = false;
      const recovered = await post(
        app,
        action === 'confirm' ? path + '/reconcile' : adminPath + '/reconcile',
        {},
        action === 'confirm' ? auth() : admin,
      );
      expect(recovered.purchase!.status).toBe(action === 'confirm' ? 'PAID' : 'CANCELED');
      const requests = action === 'confirm' ? provider.confirms : provider.cancels;
      const key =
        action === 'confirm' ? before.attempts[0].confirmIdempotencyKey : before.attempts[0].cancelIdempotencyKey;
      expect(requests).toHaveLength(2);
      expect(requests.map((request) => request.key)).toEqual([key, key]);
      if (action === 'cancel')
        expect(provider.cancels.map((request) => request.reason)).toEqual([
          'Original retry reason',
          'Original retry reason',
        ]);
      const after = await persisted();
      expect(after.attempts).toHaveLength(1);
      expect(after.attempts[0]).toMatchObject({
        orderId: body.orderId,
        confirmRequestedAt: before.attempts[0].confirmRequestedAt,
        cancelRequestedAt: before.attempts[0].cancelRequestedAt,
        cancelActor: before.attempts[0].cancelActor,
        cancelReason: before.attempts[0].cancelReason,
        operationLeaseToken: null,
        operationLeaseUntil: null,
        errorCode: null,
      });
    },
  );

  it('ignores forged and reordered webhook states and never revives a canceled purchase', async () => {
    const body = await prepare();
    const replica = await start();
    const lookup = vi.spyOn(provider, 'lookup');
    const webhook = (instance: NestFastifyApplication, orderId: string, status: string) =>
      post(
        instance,
        '/api/v1/payments/toss/webhook',
        { data: { orderId, paymentKey: 'forged-key', status, totalAmount: 1 } },
        {},
      );
    await webhook(app, body.orderId, 'DONE');
    expect(lookup).not.toHaveBeenCalled();
    expect((await persisted()).status).toBe('AWAITING_PAYMENT');

    provider.loseConfirm = true;
    provider.queryError = true;
    const uncertain = await post(app, path + '/confirm', body);
    expect(uncertain.purchase!.attempt!.status).toBe('UNKNOWN');
    provider.queryError = false;
    provider.loseConfirm = false;
    lookup.mockClear();
    await webhook(replica, body.orderId, 'CANCELED');
    expect(lookup).toHaveBeenCalledExactlyOnceWith(body.paymentKey);
    expect((await persisted()).status).toBe('PAID');
    const paidSnapshot = structuredClone(provider.payment!);
    await Promise.all(['CANCELED', 'READY', 'EXPIRED', 'DONE'].map((status) => webhook(replica, body.orderId, status)));
    expect(lookup).toHaveBeenCalledTimes(5);
    expect((await persisted()).status).toBe('PAID');

    await post(app, adminPath + '/cancel', { reason: 'Verified provider cancellation' }, admin);
    // Even a stale authenticated provider read must not undo a terminal cancellation.
    lookup.mockResolvedValue(paidSnapshot);
    await Promise.all(['DONE', 'READY', 'CANCELED', 'DONE'].map((status) => webhook(replica, body.orderId, status)));
    expect(lookup).toHaveBeenCalledTimes(9);
    const beforeUnknown = lookup.mock.calls.length;
    await webhook(app, `unknown_${randomUUID()}`, 'DONE');
    expect(lookup).toHaveBeenCalledTimes(beforeUnknown);
    expect(lookup.mock.calls.every(([paymentKey]) => paymentKey === body.paymentKey)).toBe(true);
    const final = await persisted();
    expect(final.status).toBe('CANCELED');
    expect(final.attempts).toHaveLength(1);
    expect(final.attempts[0].status).toBe('CANCELED');
    expect(provider.confirms).toHaveLength(1);
    expect(provider.cancels).toHaveLength(1);
  });
});
