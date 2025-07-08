import { z } from 'zod';

export const auctionServiceBidderCreatedSchema = z.object({
  auctionUuid: z.string(),
  bidderUuid: z.string(),
  bidAmount: z.number(),
  createdAt: z.string(),
});

export type AuctionServiceBidderCreatedDto = z.infer<typeof auctionServiceBidderCreatedSchema>;
