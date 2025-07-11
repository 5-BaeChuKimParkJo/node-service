import z from 'zod';

export const bidAuctionBatchInputSchema = z.object({
  auctionUuid: z.string(),
  bidderUuid: z.string(),
  bidAmount: z.number(),
  createdAt: z.date(),
  requestId: z.string(),
});

export type BidAuctionBatchInput = z.infer<typeof bidAuctionBatchInputSchema>;
