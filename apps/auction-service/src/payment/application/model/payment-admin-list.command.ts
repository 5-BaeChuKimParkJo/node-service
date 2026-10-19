import { Purchase } from '../../domain/payment-state';

export type PaymentAdminCursor = { createdAt: string; purchaseUuid: string };
export type PaymentAttention = 'NONE' | 'WAITING' | 'DUE_SOON' | 'OVERDUE' | 'REVIEW_REQUIRED';
export type PaymentReviewPolicy = { dueHours: number; soonHours: number };

export type PaymentAdminListCommand = {
  query?: string;
  status?: Purchase['status'];
  attention?: Exclude<PaymentAttention, 'NONE'>;
  from?: string;
  to?: string;
  cursor?: PaymentAdminCursor;
};
