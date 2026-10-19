import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentAdminListCommand } from '../model/payment-admin-list.command';
import { PaymentAdminListResult } from '../model/payment-admin-list.result';
import { PaymentAdminQueryPort } from '../port/out/payment-admin-query.port';

@Injectable()
export class PaymentAdminService {
  constructor(
    private readonly query: PaymentAdminQueryPort,
    private readonly config: ConfigService = new ConfigService(),
  ) {}

  async list(command: PaymentAdminListCommand): Promise<PaymentAdminListResult> {
    const policy = {
      dueHours: Number(this.config.get('PAYMENT_REVIEW_HOURS') ?? 24),
      soonHours: Number(this.config.get('PAYMENT_REVIEW_SOON_HOURS') ?? 6),
    };
    const rows = await this.query.find(command, { ...policy, asOf: new Date().toISOString() });
    const items = rows.slice(0, 20).map((row) => ({
      purchaseUuid: row.purchaseUuid,
      auctionUuid: row.auctionUuid,
      buyerUuid: row.buyerUuid,
      orderName: row.orderName,
      amount: row.amount.toString(),
      status: row.status,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
      reviewDueAt: row.reviewDueAt,
      attention: row.attention,
      attempt:
        row.attemptOrderId !== null
          ? {
              orderId: row.attemptOrderId,
              status: row.attemptStatus,
              method: row.attemptMethod,
              cancelReason: row.attemptCancelReason,
            }
          : null,
    }));
    const last = items[items.length - 1];
    return {
      items,
      nextCursor:
        rows.length > 20
          ? {
              createdAt: last.createdAt,
              ...(last.purchaseUuid ? { purchaseUuid: last.purchaseUuid } : { auctionUuid: last.auctionUuid }),
            }
          : null,
      policy,
    };
  }
}
