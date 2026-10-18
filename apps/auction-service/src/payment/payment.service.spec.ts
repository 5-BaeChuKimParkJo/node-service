import { fixture, auctionUuid, buyerUuid, sellerUuid } from './payment.test-fixtures';

describe('winner checkout state machine', () => {
  it('GET returns eligibility without creating a purchase or freezing the auction', async () => {
    const { service, store } = fixture();
    expect(await service.get(auctionUuid, buyerUuid)).toMatchObject({ eligible: true, purchase: null });
    expect(store.writes).toBe(0);
    expect(store.state.auction.checkoutLockedAt).toBeNull();
  });

  it.each([sellerUuid, '40000000-0000-4000-8000-000000000004'])(
    'rejects non-owner %s on GET and prepare',
    async (user) => {
      const { service, store } = fixture();
      await expect(service.get(auctionUuid, user)).rejects.toMatchObject({ status: 403 });
      await expect(service.prepare(auctionUuid, user)).rejects.toMatchObject({ status: 403 });
      expect(store.state.purchase).toBeNull();
    },
  );

  it.each(['future', 'hidden', 'cancelled', 'deleted', 'no-bids', 'zero', 'unsafe-amount'])(
    'blocks invalid auction: %s',
    async (kind) => {
      const { service, store } = fixture();
      const a = store.state.auction;
      if (kind === 'future') a.endAt = new Date('2099-01-01');
      if (kind === 'hidden' || kind === 'cancelled') a.status = kind;
      if (kind === 'deleted') a.deletedAt = new Date();
      if (kind === 'no-bids') a.currentBidderUuid = null;
      if (kind === 'zero') a.currentBid = 0n;
      if (kind === 'unsafe-amount') a.currentBid = 9007199254740993n;
      if (kind === 'no-bids') await expect(service.get(auctionUuid, buyerUuid)).rejects.toMatchObject({ status: 403 });
      else expect((await service.get(auctionUuid, buyerUuid)).eligible).toBe(false);
      await expect(service.prepare(auctionUuid, buyerUuid)).rejects.toMatchObject({
        status: kind === 'no-bids' ? 403 : 409,
      });
      expect(store.state.purchase).toBeNull();
    },
  );

  it('freezes one purchase and reuses one attempt during concurrent preparation', async () => {
    const { service, store } = fixture();
    const views = await Promise.all(Array.from({ length: 8 }, () => service.prepare(auctionUuid, buyerUuid)));
    expect(new Set(views.map((v) => v.purchase!.attempt!.orderId)).size).toBe(1);
    expect(store.state.auction.checkoutLockedAt).toBeInstanceOf(Date);
    expect(store.state.purchase!.attempts).toHaveLength(1);
    store.state.auction.currentBid = 99999n;
    store.state.auction.title = 'Changed';
    expect((await service.prepare(auctionUuid, buyerUuid)).purchase).toMatchObject({
      amount: '15000',
      orderName: 'Final bid',
    });
  });

  it('rejects tampered amounts and a key belonging to another attempt', async () => {
    const { service, provider } = fixture();
    const view = await service.prepare(auctionUuid, buyerUuid);
    const orderId = view.purchase!.attempt!.orderId;
    await expect(
      service.confirm(auctionUuid, buyerUuid, { orderId, paymentKey: 'pk', amount: '15001' }),
    ).rejects.toMatchObject({ status: 409 });
    await service.confirm(auctionUuid, buyerUuid, { orderId, paymentKey: 'pk', amount: '15000' });
    await expect(
      service.confirm(auctionUuid, buyerUuid, { orderId, paymentKey: 'different', amount: '15000' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(provider.confirms).toHaveLength(1);
  });

  it('confirms once with a stored idempotency key and returns ISO dates and string money', async () => {
    const { service, provider, store } = fixture();
    const prepared = await service.prepare(auctionUuid, buyerUuid);
    const orderId = prepared.purchase!.attempt!.orderId;
    const key = store.state.purchase!.attempts[0].confirmIdempotencyKey;
    const body = { orderId, paymentKey: 'pk', amount: '15000' };
    const views = await Promise.all([
      service.confirm(auctionUuid, buyerUuid, body),
      service.confirm(auctionUuid, buyerUuid, body),
    ]);
    expect(provider.confirms).toEqual([{ orderId, paymentKey: 'pk', amount: 15000, key }]);
    expect((await service.get(auctionUuid, buyerUuid)).purchase).toMatchObject({
      status: 'PAID',
      amount: '15000',
      paidAt: '2026-10-16T16:00:00.000Z',
    });
    expect(JSON.stringify(views)).not.toContain('Idempotency');
    expect(JSON.stringify(views)).not.toContain('paymentKey');
  });

  it('keeps an ambiguous confirmation blocked across prepare, confirm, and missing lookup', async () => {
    const { service, store, provider } = fixture();
    const orderId = (await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
    provider.loseConfirm = true;
    provider.queryError = true;
    const body = { orderId, paymentKey: 'pk', amount: '15000' };
    expect((await service.confirm(auctionUuid, buyerUuid, body)).purchase!.attempt!.status).toBe('UNKNOWN');
    expect((await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId).toBe(orderId);
    await service.confirm(auctionUuid, buyerUuid, body);
    provider.queryError = false;
    const done = provider.payment;
    provider.payment = null;
    provider.failBeforeConfirm = true;
    expect((await service.reconcile(auctionUuid, buyerUuid)).purchase!.attempt!.status).toBe('UNKNOWN');
    expect(provider.confirms.length).toBeGreaterThanOrEqual(1);
    expect(new Set(provider.confirms.map((c) => c.key)).size).toBe(1);
    expect(store.state.purchase!.attempts).toHaveLength(1);
    provider.payment = done;
    provider.failBeforeConfirm = false;
    expect((await service.reconcile(auctionUuid, buyerUuid)).purchase!.status).toBe('PAID');
  });

  it.each(['totalAmount', 'orderId', 'paymentKey', 'currency'])(
    'rejects a provider identity mismatch: %s',
    async (field) => {
      const { service, provider } = fixture();
      const orderId = (await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
      provider.loseConfirm = true;
      provider.queryError = true;
      await service.confirm(auctionUuid, buyerUuid, { orderId, paymentKey: 'pk', amount: '15000' });
      provider.queryError = false;
      (provider.payment as any)[field] = field === 'totalAmount' ? 1 : 'wrong';
      const result = await service.reconcile(auctionUuid, buyerUuid);
      expect(result.purchase!.status).toBe('AWAITING_PAYMENT');
      expect(result.purchase!.attempt!.status).toBe('UNKNOWN');
    },
  );

  it('keeps virtual accounts pending until verified DONE', async () => {
    const { service, provider } = fixture();
    const orderId = (await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
    provider.payment = {
      orderId,
      paymentKey: 'pk',
      totalAmount: 15000,
      balanceAmount: 15000,
      currency: 'KRW',
      status: 'WAITING_FOR_DEPOSIT',
    };
    expect((await service.reconcile(auctionUuid, buyerUuid)).purchase).toMatchObject({
      status: 'AWAITING_PAYMENT',
      attempt: { status: 'WAITING_FOR_DEPOSIT' },
    });
  });

  it.each(['ABORTED', 'EXPIRED'])('only replaces a verified terminal %s attempt', async (status) => {
    const { service, provider, store } = fixture();
    const orderId = (await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
    provider.payment = { orderId, paymentKey: 'pk', totalAmount: 15000, balanceAmount: 15000, currency: 'KRW', status };
    await service.reconcile(auctionUuid, buyerUuid);
    expect((await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId).not.toBe(orderId);
    expect(store.state.purchase!.attempts).toHaveLength(2);
  });

  it('does not trust forged webhook status or query unknown orders', async () => {
    const { service, provider } = fixture();
    const lookup = vi.spyOn(provider, 'lookup');
    await service.webhook({ data: { orderId: 'unknown', status: 'DONE' } });
    expect(lookup).not.toHaveBeenCalled();
    const orderId = (await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
    await service.webhook({ data: { orderId, status: 'DONE', totalAmount: 15000 } });
    expect((await service.get(auctionUuid, buyerUuid)).purchase!.status).toBe('AWAITING_PAYMENT');
  });

  it('reconciles lost cancellation without regressing from stale DONE or reopening checkout', async () => {
    const { service, provider, store } = fixture();
    const orderId = (await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
    await service.confirm(auctionUuid, buyerUuid, { orderId, paymentKey: 'pk', amount: '15000' });
    const paid = structuredClone(provider.payment);
    provider.loseCancel = true;
    provider.queryError = true;
    expect((await service.cancel(auctionUuid, 'operator', 'Customer requested')).purchase!.attempt!.status).toBe(
      'CANCELING',
    );
    const key = store.state.purchase!.attempts[0].cancelIdempotencyKey;
    expect(provider.cancels[0]).toEqual({ paymentKey: 'pk', reason: 'Customer requested', key });
    provider.queryError = false;
    expect((await service.reconcile(auctionUuid, buyerUuid)).purchase!.status).toBe('CANCELED');
    provider.payment = paid;
    await service.webhook({ data: { orderId, status: 'DONE' } });
    expect((await service.get(auctionUuid, buyerUuid)).purchase!.status).toBe('CANCELED');
    await expect(service.prepare(auctionUuid, buyerUuid)).rejects.toMatchObject({ status: 409 });
  });

  it('retries cancellation with the original reason and persisted key', async () => {
    const { service, provider } = fixture();
    const orderId = (await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
    await service.confirm(auctionUuid, buyerUuid, { orderId, paymentKey: 'pk', amount: '15000' });
    const paid = structuredClone(provider.payment);
    provider.loseCancel = true;
    provider.queryError = true;
    await service.cancel(auctionUuid, 'operator', 'Original reason');
    provider.payment = paid;
    provider.loseCancel = false;
    await service.cancel(auctionUuid, 'operator', 'Changed reason');
    expect(provider.cancels[1]).toEqual(provider.cancels[0]);
  });

  it('admin GET is read-only and omits the client key', async () => {
    const { service, store } = fixture();
    expect(await service.get(auctionUuid)).toMatchObject({ eligible: false, clientKey: null });
    expect(store.writes).toBe(0);
  });

  it.each(['hidden', 'deleted'])('rejects repeat prepare after auction becomes %s', async (kind) => {
    const { service, store } = fixture();
    await service.prepare(auctionUuid, buyerUuid);
    if (kind === 'hidden') store.state.auction.status = 'hidden';
    else store.state.auction.deletedAt = new Date();
    await expect(service.prepare(auctionUuid, buyerUuid)).rejects.toMatchObject({ status: 409 });
  });

  it('resumes the exact stored confirmation when the first request never reached Toss', async () => {
    const { service, provider, store } = fixture();
    const orderId = (await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
    provider.failBeforeConfirm = true;
    await service.confirm(auctionUuid, buyerUuid, { orderId, paymentKey: 'pk', amount: '15000' });
    expect(store.state.purchase!.attempts[0].status).toBe('UNKNOWN');
    provider.failBeforeConfirm = false;
    const result = await service.reconcile(auctionUuid, buyerUuid);
    expect(result.purchase!.status).toBe('PAID');
    expect(provider.confirms).toHaveLength(2);
    expect(provider.confirms[1]).toEqual(provider.confirms[0]);
    expect(store.state.purchase!.attempts).toHaveLength(1);
  });

  it('admin reconcile resumes a lost cancellation with its original reason and key', async () => {
    const { service, provider } = fixture();
    const orderId = (await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
    await service.confirm(auctionUuid, buyerUuid, { orderId, paymentKey: 'pk', amount: '15000' });
    provider.failBeforeCancel = true;
    await service.cancel(auctionUuid, 'operator', 'Customer requested');
    expect((await service.get(auctionUuid)).purchase!.attempt!.status).toBe('CANCELING');
    provider.failBeforeCancel = false;
    expect((await service.reconcile(auctionUuid)).purchase!.status).toBe('CANCELED');
    expect(provider.cancels[1]).toEqual(provider.cancels[0]);
  });

  it('claims only one concurrent recovery and never replays after the idempotency window', async () => {
    const { service, provider, store } = fixture();
    const orderId = (await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
    provider.failBeforeConfirm = true;
    await service.confirm(auctionUuid, buyerUuid, { orderId, paymentKey: 'pk', amount: '15000' });
    provider.failBeforeConfirm = false;
    await Promise.all(Array.from({ length: 8 }, () => service.reconcile(auctionUuid, buyerUuid)));
    expect(provider.confirms).toHaveLength(2);
    store.state.purchase!.status = 'AWAITING_PAYMENT';
    const attempt = store.state.purchase!.attempts[0];
    attempt.status = 'UNKNOWN';
    attempt.confirmRequestedAt = new Date(Date.now() - 15 * 86400000);
    provider.payment = null;
    await service.reconcile(auctionUuid, buyerUuid);
    expect(provider.confirms).toHaveLength(2);
    expect((await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId).toBe(orderId);
  });

  it('disables mutation by default', async () => {
    const { service, store } = fixture(false);
    expect((await service.get(auctionUuid, buyerUuid)).enabled).toBe(false);
    await expect(service.prepare(auctionUuid, buyerUuid)).rejects.toMatchObject({ status: 503 });
    expect(store.writes).toBe(0);
  });

  it.each(['deleted', 'hidden'])('does not resume a lost confirmation after the auction becomes %s', async (kind) => {
    const { service, provider, store } = fixture();
    const orderId = (await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
    provider.failBeforeConfirm = true;
    await service.confirm(auctionUuid, buyerUuid, { orderId, paymentKey: 'pk', amount: '15000' });
    provider.failBeforeConfirm = false;
    if (kind === 'deleted') store.state.auction.deletedAt = new Date();
    else store.state.auction.status = 'hidden';
    const view = await service.reconcile(auctionUuid, buyerUuid);
    expect(provider.confirms).toHaveLength(1);
    expect(view.purchase!.status).toBe('AWAITING_PAYMENT');
    expect(view.eligible).toBe(false);
  });

  it.each(['PARTIAL_CANCELED', 'FUTURE_PROVIDER_STATUS'])(
    'never replays confirmation after provider state %s',
    async (status) => {
      const { service, provider } = fixture();
      const orderId = (await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
      provider.failBeforeConfirm = true;
      await service.confirm(auctionUuid, buyerUuid, { orderId, paymentKey: 'pk', amount: '15000' });
      provider.failBeforeConfirm = false;
      provider.payment = {
        orderId,
        paymentKey: 'pk',
        totalAmount: 15000,
        balanceAmount: 10000,
        currency: 'KRW',
        status,
      };
      const result = await service.reconcile(auctionUuid, buyerUuid);
      expect(result.purchase!.status).toBe('AWAITING_PAYMENT');
      expect(result.purchase!.attempt!.status).toBe('UNKNOWN');
      expect(provider.confirms).toHaveLength(1);
    },
  );

  it('latches externally partial-canceled payments for review despite stale DONE reads', async () => {
    const { service, provider } = fixture();
    const orderId = (await service.prepare(auctionUuid, buyerUuid)).purchase!.attempt!.orderId;
    await service.confirm(auctionUuid, buyerUuid, { orderId, paymentKey: 'pk', amount: '15000' });
    const done = structuredClone(provider.payment);
    provider.payment = { ...done!, status: 'PARTIAL_CANCELED', balanceAmount: 10000 };
    const partial = await service.reconcile(auctionUuid, buyerUuid);
    expect(partial.purchase!.attempt).toMatchObject({ status: 'UNKNOWN', errorCode: 'PARTIAL_CANCELLATION_REVIEW' });
    provider.payment = done;
    await service.webhook({ data: { orderId } });
    expect((await service.get(auctionUuid, buyerUuid)).purchase!.attempt!.status).toBe('UNKNOWN');
    expect(provider.confirms).toHaveLength(1);
    expect(provider.cancels).toHaveLength(0);
  });
});
