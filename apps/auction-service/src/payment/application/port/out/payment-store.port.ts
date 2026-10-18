import type { PaymentState } from '../../../domain/payment-state';

export abstract class PaymentStorePort {
  abstract read(auctionUuid: string): Promise<PaymentState>;
  abstract auctionForOrder(orderId: string): Promise<string | null>;
  abstract locked<T>(auctionUuid: string, work: (state: PaymentState) => Promise<T>): Promise<T>;
}
