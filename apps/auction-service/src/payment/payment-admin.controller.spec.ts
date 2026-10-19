import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ZodExceptionFilter } from '@app/common/filter/zod-exception.filter';
import { BigIntToNumberInterceptor } from '@app/common/middleware/bigint-to-number.middleware';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentModule } from './payment.module';
import { PaymentProviderPort } from './application/port/out/payment-provider.port';
import { PaymentStorePort } from './application/port/out/payment-store.port';

const createdAt = '2026-10-18T10:11:12.123456Z';
const purchaseUuid = '10000000-0000-4000-8000-000000000001';
const row = {
  purchaseUuid,
  auctionUuid: '20000000-0000-4000-8000-000000000001',
  buyerUuid: '30000000-0000-4000-8000-000000000001',
  orderName: 'Frozen order title',
  amount: 9007199254740993n,
  status: 'PAID',
  createdAt,
  paidAt: '2026-10-18T11:00:00.654321Z',
  reviewDueAt: '2026-10-19T10:11:12.123456Z',
  attention: 'NONE',
  attemptOrderId: 'latest_order',
  attemptStatus: 'DONE',
  attemptMethod: 'CARD',
};

describe('admin payment list HTTP', () => {
  it.each(['WAITING', 'DUE_SOON', 'OVERDUE', 'REVIEW_REQUIRED'])(
    'accepts the management filter %s',
    async (attention) => {
      const response = await app.inject({ method: 'GET', url: `${path}?attention=${attention}`, headers });
      expect(response.statusCode).toBe(200);
      expect(queryRaw.mock.calls[0][0].values).toContain(attention);
      expect(response.json().policy).toEqual({ dueHours: 24, soonHours: 6 });
      expect(forbidden).not.toHaveBeenCalled();
    },
  );

  it.each(['DONE', '', 'OVERDUE&attention=WAITING'])('rejects an invalid management filter %s', async (attention) => {
    const response = await app.inject({ method: 'GET', url: `${path}?attention=${attention}`, headers });
    expect(response.statusCode).toBe(400);
    expect(queryRaw).not.toHaveBeenCalled();
  });
  let app: NestFastifyApplication;
  const path = '/api/v1/internal/admin/payments';
  const token = 'admin-payment-list-fixture-token';
  const headers = { 'x-admin-internal-token': token };
  const queryRaw = vi.fn();
  const forbidden = vi.fn(() => {
    throw new Error('Listing must not mutate or call the provider');
  });

  beforeEach(async () => {
    queryRaw.mockReset().mockResolvedValue([row]);
    forbidden.mockClear();
    const module = await Test.createTestingModule({ imports: [PaymentModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService({ ADMIN_INTERNAL_TOKEN: token }))
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .overrideProvider(PaymentStorePort)
      .useValue({ read: forbidden, locked: forbidden, auctionForOrder: forbidden })
      .overrideProvider(PaymentProviderPort)
      .useValue({ query: forbidden, confirm: forbidden, cancel: forbidden })
      .compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalFilters(new ZodExceptionFilter());
    app.useGlobalInterceptors(new BigIntToNumberInterceptor());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterEach(async () => {
    await app?.close();
  });

  it.each([undefined, { 'x-admin-internal-token': 'wrong' }])('requires the internal token: %j', async (auth) => {
    const response = await app.inject({ method: 'GET', url: path, headers: auth });
    expect(response.statusCode).toBe(401);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns exact money and timestamp text with only approved fields and no provider or mutation', async () => {
    queryRaw.mockResolvedValue([
      {
        ...row,
        paymentKey: 'sensitive',
        customerKey: 'sensitive',
        operationLeaseToken: 'sensitive',
        confirmIdempotencyKey: 'sensitive',
      },
    ]);
    const response = await app.inject({ method: 'GET', url: path, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          purchaseUuid,
          auctionUuid: row.auctionUuid,
          buyerUuid: row.buyerUuid,
          orderName: 'Frozen order title',
          amount: '9007199254740993',
          status: 'PAID',
          createdAt,
          paidAt: '2026-10-18T11:00:00.654321Z',
          reviewDueAt: row.reviewDueAt,
          attention: 'NONE',
          attempt: { orderId: 'latest_order', status: 'DONE', method: 'CARD' },
        },
      ],
      nextCursor: null,
      policy: { dueHours: 24, soonHours: 6 },
    });
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('trims query and preserves six-digit date/cursor input as SQL parameters', async () => {
    const params = new URLSearchParams({
      query: '  literal%_\\text  ',
      status: 'PAID',
      from: '2026-10-18T00:00:00Z',
      to: '2026-10-19T00:00:00Z',
      createdAt,
      purchaseUuid,
    });
    const response = await app.inject({ method: 'GET', url: `${path}?${params}`, headers });
    expect(response.statusCode).toBe(200);
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.values).toContain('literal%_\\text');
    expect(sql.values).toContain(createdAt);
    expect(sql.values).toContain(purchaseUuid);
    expect(sql.text).not.toContain('literal');
    expect(forbidden).not.toHaveBeenCalled();
  });

  it.each([
    { status: 'DONE' },
    { status: '' },
    { from: '2026-02-30T00:00:00Z' },
    { from: '2026-10-18' },
    { from: '2026-10-18T00:00:00+09:00' },
    { from: '2026-10-18T00:00:00' },
    { to: 'invalid' },
    { to: '2026-13-01T00:00:00Z' },
    { from: '2026-10-18T24:00:00Z' },
    { createdAt: 'invalid', purchaseUuid },
    { createdAt },
    { purchaseUuid },
    { createdAt, purchaseUuid: 'invalid' },
    { query: 'x'.repeat(101) },
    { from: '2026-10-18T00:00:00Z', to: '2026-10-17T00:00:00Z' },
    { from: '2026-10-18T00:00:00.123457Z', to: '2026-10-18T00:00:00.123456Z' },
    { from: '2026-10-18T00:00:00Z', to: '2026-10-18T00:00:00.000000Z' },
    { createdAt: '2026-10-18T00:00:00.1234567Z', purchaseUuid },
  ])('rejects invalid filters without reading the database: %j', async (params) => {
    const response = await app.inject({ method: 'GET', url: `${path}?${new URLSearchParams(params)}`, headers });
    expect(response.statusCode).toBe(400);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('rejects repeated scalar query fields', async () => {
    const response = await app.inject({ method: 'GET', url: `${path}?status=PAID&status=CANCELED`, headers });
    expect(response.statusCode).toBe(400);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('uses the twentieth item, never the lookahead, as the exact next cursor', async () => {
    queryRaw.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => ({
        ...row,
        purchaseUuid: `10000000-0000-4000-8000-${String(30 - i).padStart(12, '0')}`,
      })),
    );
    const response = await app.inject({ method: 'GET', url: path, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(20);
    expect(response.json().nextCursor).toEqual({ createdAt, purchaseUuid: '10000000-0000-4000-8000-000000000011' });
  });

  it.each([0, 20])('has no cursor for a final page of %i rows', async (length) => {
    queryRaw.mockResolvedValue(
      Array.from({ length }, () => ({
        ...row,
        paidAt: null,
        attemptOrderId: null,
        attemptStatus: null,
        attemptMethod: null,
      })),
    );
    const response = await app.inject({ method: 'GET', url: path, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(length);
    expect(response.json().nextCursor).toBeNull();
    if (length) expect(response.json().items[0]).toMatchObject({ paidAt: null, attempt: null });
  });
});
