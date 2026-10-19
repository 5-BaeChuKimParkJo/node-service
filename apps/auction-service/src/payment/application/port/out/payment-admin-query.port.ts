import { AttemptStatus, Purchase } from '../../../domain/payment-state';
import { PaymentAdminListCommand, PaymentAttention, PaymentReviewPolicy } from '../../model/payment-admin-list.command';

export type PaymentAdminRecord = {
  purchaseUuid: string;
  auctionUuid: string;
  buyerUuid: string;
  orderName: string;
  amount: bigint;
  status: Purchase['status'];
  createdAt: string;
  paidAt: string | null;
  reviewDueAt: string;
  attention: PaymentAttention;
  attemptCancelReason: string | null;
} & (
  | { attemptOrderId: string; attemptStatus: AttemptStatus; attemptMethod: string | null }
  | { attemptOrderId: null; attemptStatus: null; attemptMethod: null }
);

export abstract class PaymentAdminQueryPort {
  abstract find(
    command: PaymentAdminListCommand,
    policy: PaymentReviewPolicy & { asOf: string },
  ): Promise<PaymentAdminRecord[]>;
}
