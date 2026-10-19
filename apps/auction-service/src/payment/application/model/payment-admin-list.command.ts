import { Purchase } from '../../domain/payment-state';

export type PaymentAdminCursor = { createdAt: string } & (
  | { purchaseUuid: string; auctionUuid?: never }
  | { auctionUuid: string; purchaseUuid?: never }
);
export type PaymentAdminStatus = Purchase['status'] | 'NOT_STARTED';
export type PaymentAttention = 'NONE' | 'WAITING' | 'DUE_SOON' | 'OVERDUE' | 'REVIEW_REQUIRED';
export type PaymentReviewPolicy = { dueHours: number; soonHours: number };

export type PaymentAdminListCommand = {
  includeUnstarted?: boolean;
  query?: string;
  status?: PaymentAdminStatus;
  attention?: Exclude<PaymentAttention, 'NONE'>;
  from?: string;
  to?: string;
  cursor?: PaymentAdminCursor;
};
