import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PaymentStore, PaymentState } from './payment.store';
import { TossProvider, ProviderPayment } from './toss.provider';

export const auctionUuid = '10000000-0000-4000-8000-000000000001';
export const buyerUuid = '20000000-0000-4000-8000-000000000002';
export const sellerUuid = '30000000-0000-4000-8000-000000000003';

export class MemoryPaymentStore extends PaymentStore {
  state: PaymentState = {
    auction: { auctionUuid, title: 'Final bid', currentBid: 15000n, currentBidderUuid: buyerUuid,
      sellerUuid, endAt: new Date('2026-01-01'), status: 'visible', deletedAt: null, checkoutLockedAt: null },
    purchase: null,
  };
  writes = 0;
  private tail: Promise<unknown> = Promise.resolve();
  async read() { return structuredClone(this.state); }
  async auctionForOrder(orderId: string) {
    return this.state.purchase?.attempts.some(a => a.orderId === orderId) ? auctionUuid : null;
  }
  async locked<T>(_uuid: string, work: (state: PaymentState) => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => {
      const state = structuredClone(this.state);
      const value = await work(state);
      this.state = state;
      this.writes++;
      return value;
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
}

export class FakeTossProvider extends TossProvider {
  payment: ProviderPayment | null = null;
  confirms: Array<{ orderId: string; paymentKey: string; amount: number; key: string }> = [];
  cancels: Array<{ paymentKey: string; reason: string; key: string }> = [];
  queryError = false;
  loseConfirm = false;
  loseCancel = false;
  failBeforeConfirm = false;
  failBeforeCancel = false;
  constructor() { super(new ConfigService()); }
  async confirm(orderId: string, paymentKey: string, amount: number, key: string) {
    this.confirms.push({ orderId, paymentKey, amount, key });
    if (this.failBeforeConfirm) throw new Error('request lost before provider');
    this.payment = { orderId, paymentKey, totalAmount: amount, balanceAmount: amount, currency: 'KRW',
      status: 'DONE', method: 'CARD', approvedAt: '2026-10-17T01:00:00+09:00' };
    if (this.loseConfirm) throw new Error('lost response');
    return this.payment;
  }
  async lookup(_orderId: string) {
    if (this.queryError) throw new Error('query unavailable');
    return this.payment;
  }
  async cancel(paymentKey: string, reason: string, key: string) {
    this.cancels.push({ paymentKey, reason, key });
    if (this.failBeforeCancel) throw new Error('request lost before provider');
    this.payment = { ...this.payment!, status: 'CANCELED', balanceAmount: 0 };
    if (this.loseCancel) throw new Error('lost cancel response');
    return this.payment;
  }
}

export function fixture(enabled = true) {
  const store = new MemoryPaymentStore();
  const provider = new FakeTossProvider();
  const config = new ConfigService({ TOSS_PAYMENTS_ENABLED: enabled, TOSS_CLIENT_KEY: 'test_gck_fixture' });
  return { store, provider, config, service: new PaymentService(store, provider, config) };
}
