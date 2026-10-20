import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminHistoryService } from '../../../application/service/admin-history.service';
import { InternalAdminTokenGuard } from './internal-admin-token.guard';

const timestamp = z
  .string()
  .datetime()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/)
  .refine((value) => !value.startsWith('0000-'), 'Invalid year');
const comparable = (value: string) => {
  const [seconds, fraction = ''] = value.slice(0, -1).split('.');
  return `${seconds}.${fraction.padEnd(6, '0')}Z`;
};
const entryKey = z.union([
  z.string().regex(/^auction:[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i),
  z.string().regex(/^payment:[\w-]{6,64}$/),
]);
const requestSchema = z
  .object({
    action: z.enum(['hide', 'restore', 'force-end', 'payment-cancel']).optional(),
    auctionUuid: z.string().uuid().optional(),
    from: timestamp.optional(),
    to: timestamp.optional(),
    occurredAt: timestamp.optional(),
    entryKey: entryKey.optional(),
  })
  .refine((request) => (request.occurredAt !== undefined) === (request.entryKey !== undefined), 'Incomplete cursor')
  .refine(
    (request) => !request.from || !request.to || comparable(request.from) < comparable(request.to),
    'from must precede to',
  );

@Controller({ path: 'internal/admin/history', version: '1' })
@UseGuards(InternalAdminTokenGuard)
export class AdminHistoryController {
  constructor(private readonly history: AdminHistoryService) {}

  @Get()
  list(@Query() request: unknown) {
    const { occurredAt, entryKey, ...filters } = requestSchema.parse(request);
    return this.history.list({ ...filters, ...(occurredAt ? { cursor: { occurredAt, entryKey: entryKey! } } : {}) });
  }
}
