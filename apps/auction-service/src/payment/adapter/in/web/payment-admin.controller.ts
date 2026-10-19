import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { InternalAdminTokenGuard } from '../../../../auction/adapter/in/web/internal-admin-token.guard';
import { PaymentAdminService } from '../../../application/service/payment-admin.service';

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
    query: z.string().trim().max(100).optional(),
    status: z.enum(['AWAITING_PAYMENT', 'PAID', 'CANCELED']).optional(),
    attention: z.enum(['WAITING', 'DUE_SOON', 'OVERDUE', 'REVIEW_REQUIRED']).optional(),
    from: utcTimestamp.optional(),
    to: utcTimestamp.optional(),
    createdAt: utcTimestamp.optional(),
    purchaseUuid: z.string().uuid().optional(),
  })
  .refine((value) => (value.createdAt !== undefined) === (value.purchaseUuid !== undefined), {
    message: 'createdAt and purchaseUuid must be provided together',
  })
  .refine((value) => !value.from || !value.to || comparableTimestamp(value.from) < comparableTimestamp(value.to), {
    message: 'from must precede to',
  });

@Controller({ path: 'internal/admin/payments', version: '1' })
@UseGuards(InternalAdminTokenGuard)
export class PaymentAdminController {
  constructor(private readonly payments: PaymentAdminService) {}

  @Get()
  list(@Query() request: unknown) {
    const { createdAt, purchaseUuid, ...filters } = listRequest.parse(request);
    return this.payments.list({
      ...filters,
      cursor: createdAt && purchaseUuid ? { createdAt, purchaseUuid } : undefined,
    });
  }
}
