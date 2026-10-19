import { PaymentReviewPolicy } from '../../model/payment-admin-list.command';

export type PaymentAdminCounts = {
  endingSoon: bigint;
  notStarted: bigint;
  overdue: bigint;
  reviewRequired: bigint;
};

export abstract class PaymentAdminSummaryPort {
  abstract summarize(policy: PaymentReviewPolicy & { asOf: string }): Promise<PaymentAdminCounts>;
}
