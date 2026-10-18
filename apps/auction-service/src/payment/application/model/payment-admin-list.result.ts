import { AttemptStatus, Purchase } from '../../domain/payment-state';
import { PaymentAdminCursor } from './payment-admin-list.command';

export type PaymentAdminListItem = {
  purchaseUuid: string;
  auctionUuid: string;
  buyerUuid: string;
  orderName: string;
  amount: string;
  status: Purchase['status'];
  createdAt: string;
  paidAt: string | null;
  attempt: { orderId: string; status: AttemptStatus; method: string | null } | null;
};

export type PaymentAdminListResult = {
  items: PaymentAdminListItem[];
  nextCursor: PaymentAdminCursor | null;
};
