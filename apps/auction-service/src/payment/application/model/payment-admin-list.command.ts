import { Purchase } from '../../domain/payment-state';

export type PaymentAdminCursor = { createdAt: string; purchaseUuid: string };

export type PaymentAdminListCommand = {
  query?: string;
  status?: Purchase['status'];
  from?: string;
  to?: string;
  cursor?: PaymentAdminCursor;
};
