export type PaymentProviderResult = {
  orderId: string;
  paymentKey: string;
  totalAmount: number;
  balanceAmount: number;
  currency: string;
  status: string;
  method?: string | null;
  approvedAt?: string | null;
};

export class PaymentProviderUnavailable extends Error {
  constructor(readonly code: string) {
    super('Payment provider unavailable');
  }
}

export abstract class PaymentProviderPort {
  abstract confirm(orderId: string, paymentKey: string, amount: number, key: string): Promise<PaymentProviderResult>;
  abstract lookup(orderId: string): Promise<PaymentProviderResult | null>;
  abstract cancel(paymentKey: string, reason: string, key: string): Promise<PaymentProviderResult>;
}
