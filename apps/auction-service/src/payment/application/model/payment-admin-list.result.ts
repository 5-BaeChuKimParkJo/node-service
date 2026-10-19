import { AttemptStatus, Purchase } from '../../domain/payment-state';
import { PaymentAdminCursor, PaymentAttention, PaymentReviewPolicy } from './payment-admin-list.command';

export type PaymentAdminListItem = {
  purchaseUuid: string;
  auctionUuid: string;
  buyerUuid: string;
  orderName: string;
  amount: string;
  status: Purchase['status'];
  createdAt: string;
  paidAt: string | null;
  reviewDueAt: string;
  attention: PaymentAttention;
  attempt: { orderId: string; status: AttemptStatus; method: string | null } | null;
};

export type PaymentAdminListResult = {
  items: PaymentAdminListItem[];
  nextCursor: PaymentAdminCursor | null;
  policy: PaymentReviewPolicy;
};
