import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

const paymentSchema = z.object({
  orderId: z.string(), paymentKey: z.string().min(1).max(200),
  totalAmount: z.number().int().nonnegative().safe(), balanceAmount: z.number().int().nonnegative().safe(),
  currency: z.string(), status: z.string(), method: z.string().nullable().optional(),
  approvedAt: z.string().datetime({ offset: true }).nullable().optional(),
});
export type ProviderPayment = z.infer<typeof paymentSchema>;
export class TossUnavailable extends Error {
  constructor(readonly code: string) { super('Payment provider unavailable'); }
}

@Injectable()
export class TossProvider {
  constructor(private readonly config: ConfigService) {}

  private async request(path: string, body?: object, key?: string): Promise<ProviderPayment | null> {
    const secret = this.config.get<string>('TOSS_SECRET_KEY');
    if (this.config.get('TOSS_PAYMENTS_ENABLED') !== true || !secret || !/^test_gsk_[A-Za-z0-9_-]+$/.test(secret)) {
      throw new ServiceUnavailableException('Test payments are not configured');
    }
    try {
      const response = await fetch(`https://api.tosspayments.com/v1${path}`, {
        method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`,
          'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { code?: unknown };
        if (!body && response.status === 404 && error.code === 'NOT_FOUND_PAYMENT') return null;
        throw new TossUnavailable(typeof error.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : 'PROVIDER_ERROR');
      }
      return paymentSchema.parse(await response.json());
    } catch (error) {
      if (error instanceof TossUnavailable) throw error;
      throw new TossUnavailable('PROVIDER_UNAVAILABLE');
    }
  }

  async confirm(orderId: string, paymentKey: string, amount: number, key: string): Promise<ProviderPayment> {
    return (await this.request('/payments/confirm', { orderId, paymentKey, amount }, key))!;
  }
  lookup(orderId: string) { return this.request(`/payments/orders/${encodeURIComponent(orderId)}`); }
  async cancel(paymentKey: string, reason: string, key: string): Promise<ProviderPayment> {
    return (await this.request(`/payments/${encodeURIComponent(paymentKey)}/cancel`, { cancelReason: reason }, key))!;
  }
}
