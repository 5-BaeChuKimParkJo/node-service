import { AttemptStatus } from '../../domain/payment-state';
import {
  PaymentAdminCursor,
  PaymentAdminStatus,
  PaymentAttention,
  PaymentReviewPolicy,
} from './payment-admin-list.command';

export type PaymentAdminListItem = {
  purchaseUuid: string | null;
  auctionUuid: string;
  buyerUuid: string;
  orderName: string;
  amount: string;
  status: PaymentAdminStatus;
  createdAt: string;
  paidAt: string | null;
  reviewDueAt: string;
  attention: PaymentAttention;
  attempt: { orderId: string; status: AttemptStatus; method: string | null; cancelReason: string | null } | null;
};

export type PaymentAdminListResult = {
  items: PaymentAdminListItem[];
  nextCursor: PaymentAdminCursor | null;
  policy: PaymentReviewPolicy;
};
