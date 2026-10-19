import { envSchema } from '../common/env-schema';
import { ConfigService } from '@nestjs/config';
import { TossPaymentAdapter } from './adapter/out/http/toss-payment.adapter';

const base = {
  DB_URL: 'postgresql://local/test',
  CATALOG_QUERY_SERVICE: 'local',
  MEMBER_SERVICE: 'local',
  JWT_SECRET: 'test-secret-at-least-thirty-two-characters',
  ADMIN_INTERNAL_TOKEN: 'test-internal-token-at-least-24',
};

describe('test-only payment configuration and transport', () => {
  it('defaults advisory deadlines to 24 hours and the warning window to 6 hours', () => {
    expect(envSchema.parse(base)).toMatchObject({ PAYMENT_REVIEW_HOURS: 24, PAYMENT_REVIEW_SOON_HOURS: 6 });
    expect(envSchema.parse({ ...base, PAYMENT_REVIEW_HOURS: '48', PAYMENT_REVIEW_SOON_HOURS: '12' })).toMatchObject({
      PAYMENT_REVIEW_HOURS: 48,
      PAYMENT_REVIEW_SOON_HOURS: 12,
    });
  });
  it.each([
    { PAYMENT_REVIEW_HOURS: '0' },
    { PAYMENT_REVIEW_HOURS: '169' },
    { PAYMENT_REVIEW_HOURS: '1.5' },
    { PAYMENT_REVIEW_SOON_HOURS: '0' },
    { PAYMENT_REVIEW_SOON_HOURS: '25' },
    { PAYMENT_REVIEW_HOURS: 'bad' },
  ])('rejects invalid advisory deadline configuration: %j', (values) => {
    expect(envSchema.safeParse({ ...base, ...values }).success).toBe(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to disabled and parses false as false', () => {
    expect(envSchema.parse(base).TOSS_PAYMENTS_ENABLED).toBe(false);
    expect(envSchema.parse({ ...base, TOSS_PAYMENTS_ENABLED: 'false' }).TOSS_PAYMENTS_ENABLED).toBe(false);
  });
  it.each([
    { TOSS_PAYMENTS_ENABLED: 'true' },
    { TOSS_PAYMENTS_ENABLED: 'true', TOSS_CLIENT_KEY: 'live_gck_x', TOSS_SECRET_KEY: 'test_gsk_x' },
    { TOSS_PAYMENTS_ENABLED: 'false', TOSS_SECRET_KEY: 'live_gsk_x' },
    { TOSS_PAYMENTS_ENABLED: 'true', TOSS_CLIENT_KEY: 'test_ck_x', TOSS_SECRET_KEY: 'test_sk_x' },
    { TOSS_PAYMENTS_ENABLED: 'yes' },
  ])('rejects missing, unsupported, or live keys: %j', (values) => {
    expect(envSchema.safeParse({ ...base, ...values }).success).toBe(false);
  });

  it('uses fixed official URL, Basic secret-colon, and stored POST keys without redirects', async () => {
    const fetcher = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            orderId: 'test_order',
            paymentKey: 'pk',
            totalAmount: 15000,
            balanceAmount: 15000,
            currency: 'KRW',
            status: 'DONE',
          }),
        ),
    );
    vi.stubGlobal('fetch', fetcher);
    const provider = new TossPaymentAdapter(
      new ConfigService({ TOSS_PAYMENTS_ENABLED: true, TOSS_SECRET_KEY: 'test_gsk_fixture' }),
    );
    await provider.confirm('test_order', 'pk', 15000, 'stored-confirm-key');
    await provider.cancel('pk', 'Customer requested', 'stored-cancel-key');
    expect(fetcher.mock.calls[0][0]).toBe('https://api.tosspayments.com/v1/payments/confirm');
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      redirect: 'error',
      headers: { Authorization: 'Basic dGVzdF9nc2tfZml4dHVyZTo=', 'Idempotency-Key': 'stored-confirm-key' },
    });
    expect(fetcher.mock.calls[1][0]).toBe('https://api.tosspayments.com/v1/payments/pk/cancel');
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      headers: { 'Idempotency-Key': 'stored-cancel-key' },
      body: '{"cancelReason":"Customer requested"}',
    });
  });

  it('rejects live keys at the network boundary without a request', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const provider = new TossPaymentAdapter(
      new ConfigService({ TOSS_PAYMENTS_ENABLED: true, TOSS_SECRET_KEY: 'live_gsk_fixture' }),
    );
    await expect(provider.lookup('test_order')).rejects.toMatchObject({ status: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('looks up by encoded paymentKey using the endpoint supported by widget secret keys', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"code":"NOT_FOUND_PAYMENT"}', { status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    const provider = new TossPaymentAdapter(
      new ConfigService({ TOSS_PAYMENTS_ENABLED: true, TOSS_SECRET_KEY: 'test_gsk_fixture' }),
    );
    expect(await provider.lookup('payment/key')).toBeNull();
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.tosspayments.com/v1/payments/payment%2Fkey',
      expect.objectContaining({ method: 'GET', redirect: 'error' }),
    );
  });

  it('treats only NOT_FOUND_PAYMENT as a missing query and sanitizes transport errors', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"code":"NOT_FOUND_PAYMENT"}', { status: 404 }))
      .mockRejectedValueOnce(new Error('secret details'));
    vi.stubGlobal('fetch', fetcher);
    const provider = new TossPaymentAdapter(
      new ConfigService({ TOSS_PAYMENTS_ENABLED: true, TOSS_SECRET_KEY: 'test_gsk_fixture' }),
    );
    expect(await provider.lookup('test_order')).toBeNull();
    await expect(provider.lookup('test_order')).rejects.toThrow('Payment provider unavailable');
  });
});
