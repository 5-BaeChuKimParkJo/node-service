import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as jwt from 'jsonwebtoken';
import { BigIntToNumberInterceptor } from '@app/common/middleware/bigint-to-number.middleware';
import { ZodExceptionFilter } from '@app/common/filter/zod-exception.filter';
import { PaymentController, AdminPaymentController, TossWebhookController } from './adapter/in/web/payment.controller';
import { PaymentService } from './application/service/payment.service';
import { InternalAdminTokenGuard } from '../auction/adapter/in/web/internal-admin-token.guard';
import { auctionUuid, buyerUuid, sellerUuid, fixture } from './payment.test-fixtures';

describe('payment HTTP authorization and DTO contract', () => {
  let app: NestFastifyApplication;
  let f: ReturnType<typeof fixture>;
  const secret = 'payment-http-test-secret-at-least-32';
  const token = 'payment-internal-test-token-at-least-24';
  const path = '/api/v1/auctions/' + auctionUuid + '/checkout';
  const adminPath = '/api/v1/internal/admin/auctions/' + auctionUuid + '/payment';
  const auth = (memberUuid = buyerUuid) => ({
    authorization:
      'Bearer ' + jwt.sign({ memberUuid, role: 'user', token_type: 'access' }, secret, { issuer: 'cn-account' }),
  });
  const admin = { 'x-admin-internal-token': token, 'x-admin-actor': 'operator' };

  beforeAll(() => {
    vi.stubEnv('JWT_SECRET', secret);
  });
  beforeEach(async () => {
    f = fixture();
    const module = await Test.createTestingModule({
      controllers: [PaymentController, AdminPaymentController, TossWebhookController],
      providers: [
        { provide: PaymentService, useValue: f.service },
        { provide: ConfigService, useValue: new ConfigService({ ADMIN_INTERNAL_TOKEN: token }) },
        InternalAdminTokenGuard,
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalInterceptors(new BigIntToNumberInterceptor());
    app.useGlobalFilters(new ZodExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterEach(async () => {
    await app?.close();
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('rejects arbitrary member headers and non-winning signed JWTs', async () => {
    expect((await app.inject({ method: 'GET', url: path, headers: { 'x-member-uuid': buyerUuid } })).statusCode).toBe(
      401,
    );
    expect((await app.inject({ method: 'GET', url: path, headers: auth(sellerUuid) })).statusCode).toBe(403);
    expect(f.store.writes).toBe(0);
  });

  it('GET never prepares; POST authenticates and serializes exact money and ISO dates', async () => {
    const read = await app.inject({ method: 'GET', url: path, headers: auth() });
    expect(read.statusCode).toBe(200);
    expect(read.json().purchase).toBeNull();
    expect(f.store.writes).toBe(0);
    const prepared = await app.inject({ method: 'POST', url: path, headers: auth(), payload: {} });
    expect(prepared.statusCode).toBe(200);
    const orderId = prepared.json().purchase.attempt.orderId;
    const done = await app.inject({
      method: 'POST',
      url: path + '/confirm',
      headers: auth(),
      payload: { orderId, paymentKey: 'pk', amount: '15000' },
    });
    expect(done.statusCode).toBe(200);
    expect(done.json().purchase).toMatchObject({
      amount: '15000',
      paidAt: '2026-10-16T16:00:00.000Z',
      attempt: { approvedAt: '2026-10-16T16:00:00.000Z' },
    });
    expect(Object.keys(done.json().purchase.attempt).sort()).toEqual([
      'approvedAt',
      'cancelReason',
      'errorCode',
      'method',
      'orderId',
      'status',
    ]);
  });

  it.each([
    { orderId: 'valid_order', paymentKey: 'pk', amount: 15000 },
    { orderId: 'valid_order', paymentKey: 'pk', amount: '01' },
    { orderId: 'valid_order', paymentKey: '', amount: '15000' },
    { orderId: 'valid_order', paymentKey: 'pk', amount: '15000', buyerUuid: sellerUuid },
  ])('validates confirm before mutation: %j', async (payload) => {
    const response = await app.inject({ method: 'POST', url: path + '/confirm', headers: auth(), payload });
    expect(response.statusCode).toBe(400);
    expect(f.store.writes).toBe(0);
  });

  it.each(['GET', 'POST'] as const)('protects admin %s with internal token', async (method) => {
    const response = await app.inject({
      method,
      url: adminPath + (method === 'POST' ? '/cancel' : ''),
      payload: method === 'POST' ? { reason: 'Customer requested' } : undefined,
    });
    expect(response.statusCode).toBe(401);
    expect(f.store.writes).toBe(0);
  });

  it('requires actor on admin cancel and reconcile', async () => {
    for (const action of ['cancel', 'reconcile']) {
      const response = await app.inject({
        method: 'POST',
        url: adminPath + '/' + action,
        headers: { 'x-admin-internal-token': token },
        payload: {},
      });
      expect(response.statusCode).toBe(400);
    }
    expect(f.store.writes).toBe(0);
  });

  it('admin GET is local and explicit reconcile recovers an uncertain cancellation', async () => {
    const orderId = (await f.service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
    await f.service.confirm(auctionUuid, buyerUuid, { orderId, paymentKey: 'pk', amount: '15000' });
    f.provider.loseCancel = true;
    f.provider.queryError = true;
    await f.service.cancel(auctionUuid, 'operator', 'Customer requested');
    f.provider.queryError = false;
    const writes = f.store.writes;
    const read = await app.inject({ method: 'GET', url: adminPath, headers: admin });
    expect(read.json()).toMatchObject({
      eligible: false,
      clientKey: null,
      purchase: { attempt: { status: 'CANCELING' } },
    });
    expect(f.store.writes).toBe(writes);
    const result = await app.inject({ method: 'POST', url: adminPath + '/reconcile', headers: admin, payload: {} });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ eligible: false, clientKey: null, purchase: { status: 'CANCELED' } });
    expect(f.provider.confirms).toHaveLength(1);
    expect(f.provider.cancels).toHaveLength(1);
  });

  it('rejects invalid UUIDs and absent or short cancellation reasons', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/auctions/invalid/checkout', headers: auth() })).statusCode,
    ).toBe(400);
    for (const payload of [{}, { reason: 'no' }]) {
      expect(
        (await app.inject({ method: 'POST', url: adminPath + '/cancel', headers: admin, payload })).statusCode,
      ).toBe(400);
    }
  });

  it('accepts unsigned webhooks without trusting their claimed state', async () => {
    const orderId = (await f.service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
    const result = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/toss/webhook',
      payload: { data: { orderId, status: 'DONE' } },
    });
    expect(result.statusCode).toBe(200);
    expect(f.store.state.purchase!.status).toBe('AWAITING_PAYMENT');
  });
});
