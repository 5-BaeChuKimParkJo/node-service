import { Injectable } from '@nestjs/common';
import { PaymentAdminListCommand } from '../model/payment-admin-list.command';
import { PaymentAdminListResult } from '../model/payment-admin-list.result';
import { PaymentAdminQueryPort } from '../port/out/payment-admin-query.port';

@Injectable()
export class PaymentAdminService {
  constructor(private readonly query: PaymentAdminQueryPort) {}

  async list(command: PaymentAdminListCommand): Promise<PaymentAdminListResult> {
    const rows = await this.query.find(command);
    const items = rows.slice(0, 20).map((row) => ({
      purchaseUuid: row.purchaseUuid,
      auctionUuid: row.auctionUuid,
      buyerUuid: row.buyerUuid,
      orderName: row.orderName,
      amount: row.amount.toString(),
      status: row.status,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
      attempt:
        row.attemptOrderId !== null
          ? { orderId: row.attemptOrderId, status: row.attemptStatus, method: row.attemptMethod }
          : null,
    }));
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: rows.length > 20 ? { createdAt: last.createdAt, purchaseUuid: last.purchaseUuid } : null,
    };
  }
}
