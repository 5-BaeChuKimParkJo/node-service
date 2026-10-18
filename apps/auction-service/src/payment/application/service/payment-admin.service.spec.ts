import { PaymentAdminService } from './payment-admin.service';

describe('PaymentAdminService', () => {
  const createdAt = '2026-10-18T10:00:00.000001Z';
  const record = {
    purchaseUuid: '10000000-0000-4000-8000-000000000001',
    auctionUuid: '20000000-0000-4000-8000-000000000001',
    buyerUuid: '30000000-0000-4000-8000-000000000001',
    orderName: 'Frozen title',
    amount: 9007199254740993n,
    status: 'PAID' as const,
    createdAt,
    paidAt: createdAt,
    attemptOrderId: 'newest',
    attemptStatus: 'DONE' as const,
    attemptMethod: null,
    paymentKey: 'redact',
    customerKey: 'redact',
    operationLeaseToken: 'redact',
    cancelIdempotencyKey: 'redact',
  };

  it('projects an explicit allowlist and serializes money without losing precision', async () => {
    const service = new PaymentAdminService({ find: async () => [record] });
    expect(await service.list({})).toEqual({
      items: [
        {
          purchaseUuid: record.purchaseUuid,
          auctionUuid: record.auctionUuid,
          buyerUuid: record.buyerUuid,
          orderName: 'Frozen title',
          amount: '9007199254740993',
          status: 'PAID',
          createdAt,
          paidAt: createdAt,
          attempt: { orderId: 'newest', status: 'DONE', method: null },
        },
      ],
      nextCursor: null,
    });
  });

  it('preserves timestamp precision for the last returned item and excludes the lookahead', async () => {
    const records = Array.from({ length: 21 }, (_, i) => ({
      ...record,
      createdAt: `2026-10-18T10:00:00.${String(100 - i).padStart(6, '0')}Z`,
    }));
    const result = await new PaymentAdminService({ find: async () => records }).list({});
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toEqual({ createdAt: '2026-10-18T10:00:00.000081Z', purchaseUuid: record.purchaseUuid });
  });

  it('returns null for an absent attempt and paidAt', async () => {
    const result = await new PaymentAdminService({
      find: async () => [{ ...record, paidAt: null, attemptOrderId: null, attemptStatus: null }],
    }).list({});
    expect(result.items[0]).toMatchObject({ attempt: null, paidAt: null });
  });
});
