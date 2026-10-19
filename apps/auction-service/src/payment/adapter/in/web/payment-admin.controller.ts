import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { InternalAdminTokenGuard } from '../../../../auction/adapter/in/web/internal-admin-token.guard';
import { PaymentAdminService } from '../../../application/service/payment-admin.service';
import { PaymentAdminSummaryService } from '../../../application/service/payment-admin-summary.service';

const utcTimestamp = z
  .string()
  .datetime()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/)
  .refine((value) => !value.startsWith('0000-'), 'Invalid year');

// Fixed-width UTC text compares chronologically without truncating fractional seconds.
const comparableTimestamp = (value: string) => {
  const [seconds, fraction = ''] = value.slice(0, -1).split('.');
  return `${seconds}.${fraction.padEnd(6, '0')}Z`;
};

const listRequest = z
  .object({
    includeUnstarted: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    query: z.string().trim().max(100).optional(),
    status: z.enum(['NOT_STARTED', 'AWAITING_PAYMENT', 'PAID', 'CANCELED']).optional(),
    attention: z.enum(['WAITING', 'DUE_SOON', 'OVERDUE', 'REVIEW_REQUIRED']).optional(),
    from: utcTimestamp.optional(),
    to: utcTimestamp.optional(),
    createdAt: utcTimestamp.optional(),
    purchaseUuid: z.string().uuid().optional(),
    auctionUuid: z.string().uuid().optional(),
  })
  .refine(
    (value) =>
      (value.createdAt !== undefined) === (value.purchaseUuid !== undefined || value.auctionUuid !== undefined) &&
      !(value.purchaseUuid !== undefined && value.auctionUuid !== undefined),
    {
      message: 'createdAt and exactly one cursor ID must be provided together',
    },
  )
  .refine((value) => !value.from || !value.to || comparableTimestamp(value.from) < comparableTimestamp(value.to), {
    message: 'from must precede to',
  });

@Controller({ path: 'internal/admin/payments', version: '1' })
@UseGuards(InternalAdminTokenGuard)
export class PaymentAdminController {
  constructor(
    private readonly payments: PaymentAdminService,
    private readonly summary: PaymentAdminSummaryService,
  ) {}

  @Get('summary')
  summarize() {
    return this.summary.summarize();
  }

  @Get()
  list(@Query() request: unknown) {
    const { createdAt, purchaseUuid, auctionUuid, ...filters } = listRequest.parse(request);
    return this.payments.list({
      ...filters,
      cursor: createdAt
        ? purchaseUuid
          ? { createdAt, purchaseUuid }
          : { createdAt, auctionUuid: auctionUuid! }
        : undefined,
    });
  }
}
