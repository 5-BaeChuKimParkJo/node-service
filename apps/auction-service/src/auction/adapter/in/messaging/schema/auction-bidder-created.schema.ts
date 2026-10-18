import { z } from 'zod';

export const auctionServiceBidderCreatedSchema = z.object({
  auctionUuid: z.string(),
  bidderUuid: z.string(),
  bidAmount: z.number(),
  createdAt: z.string(),
  requestId: z.string(),
});

export type AuctionBidCreatedEvent = z.infer<typeof auctionServiceBidderCreatedSchema>;
