import { z } from 'zod';

export const AuctionChangedKeySchema = z.object({
  auctionId: z.number(),
});

export type AuctionChangedKey = z.infer<typeof AuctionChangedKeySchema>;

export const AuctionSchema = z.object({
  auctionId: z.number(),
  auctionUuid: z.string(),
  categoryId: z.number(),
  title: z.string(),
  description: z.string(),
  minimumBid: z.number(),
  startAt: z.string(),
  endAt: z.string(),
  isDirectDeal: z.boolean(),
  directDealLocation: z.string(),
  status: z.string(),
  productCondition: z.string(),
  viewCount: z.number(),
  thumbnailKey: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  version: z.number(),
  sellerUuid: z.string(),
  currentBid: z.number(),
});

export type Auction = z.infer<typeof AuctionSchema>;

export const AuctionChangedValueSchema = z
  .object({
    before: AuctionSchema.nullable(),
    after: AuctionSchema.nullable(),
    op: z.enum(['c', 'u', 'd', 'r']),
    ts_ms: z.number(),
  })
  .strip();

export type AuctionChangedValue = z.infer<typeof AuctionChangedValueSchema>;
