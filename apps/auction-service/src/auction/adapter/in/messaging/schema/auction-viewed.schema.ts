import { z } from 'zod';

export const auctionViewedSchema = z.object({
  auctionUuid: z.string(),
  bidderUuid: z.string(),
  bidAmount: z.number(),
  createdAt: z.string(),
});

export type AuctionViewed = z.infer<typeof auctionViewedSchema>;
