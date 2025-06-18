import { z } from 'zod';

export const AuctionSchema = z.object({
  auctionUuid: z.string(),
  title: z.string(),
  description: z.string(),
  minimumBid: z.number(),
  startAt: z.date(),
  endAt: z.date(),
  isDirectDeal: z.boolean(),
  directDealLocation: z.string().nullable(),
  productCondition: z.string(),
  viewCount: z.number(),
  thumbnailUrl: z.string(),
  createdAt: z.date(),
  version: z.number(),
  sellerUuid: z.string(),
  currentBid: z.number(),
});

export type Auction = z.infer<typeof AuctionSchema>;
