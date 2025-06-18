import { z } from 'zod';

export const outboxSchema = z.object({
  aggregateType: z.string(),
  aggregateId: z.string(),
  eventType: z.enum(['AuctionCreated', 'AuctionUpdated', 'AuctionDeleted']),
  op: z.enum(['c', 'u', 'd']),
  payload: z.string().transform((val) => JSON.parse(val)),
});
export type Outbox = z.infer<typeof outboxSchema>;
