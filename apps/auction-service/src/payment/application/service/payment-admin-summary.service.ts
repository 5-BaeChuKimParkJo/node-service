import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENDING_SOON_HOURS } from '../../../auction/domain/model/auction-operations-policy';
import { PaymentAdminSummaryPort } from '../port/out/payment-admin-summary.port';
import { PaymentAdminSummaryResult } from '../model/payment-admin-summary.result';

@Injectable()
export class PaymentAdminSummaryService {
  constructor(
    private readonly query: PaymentAdminSummaryPort,
    private readonly config: ConfigService,
  ) {}

  async summarize(): Promise<PaymentAdminSummaryResult> {
    const asOf = new Date().toISOString();
    const counts = await this.query.summarize({
      asOf,
      dueHours: Number(this.config.get('PAYMENT_REVIEW_HOURS') ?? 24),
      soonHours: Number(this.config.get('PAYMENT_REVIEW_SOON_HOURS') ?? 6),
    });
    return {
      asOf,
      endingHours: ENDING_SOON_HOURS,
      endingSoon: counts.endingSoon.toString(),
      notStarted: counts.notStarted.toString(),
      overdue: counts.overdue.toString(),
      reviewRequired: counts.reviewRequired.toString(),
    };
  }
}
