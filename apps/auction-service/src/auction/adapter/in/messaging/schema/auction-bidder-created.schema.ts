import { z } from 'zod';

export const auctionBidderCreatedSchema = z.object({
  auctionUuid: z.string(),
  bidderUuid: z.string(),
  bidAmount: z.number(),
  createdAt: z.string(),
});

export type AuctionBidderCreatedDto = z.infer<typeof auctionBidderCreatedSchema>;
