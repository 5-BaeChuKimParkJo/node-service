import { z } from 'zod';

export const remoteAuctionSchema = z.object({
  auctionUuid: z.string(),
  title: z.string(),
  description: z.string(),
  minimumBid: z.number(),
  startAt: z.preprocess((arg) => (typeof arg === 'string' || typeof arg === 'number' ? new Date(arg) : arg), z.date()),
  endAt: z.preprocess((arg) => (typeof arg === 'string' || typeof arg === 'number' ? new Date(arg) : arg), z.date()),
  isDirectDeal: z.boolean(),
  directDealLocation: z.string().nullable(),
  productCondition: z.string(),
  viewCount: z.number(),
  thumbnailUrl: z.string(),
  createdAt: z.preprocess(
    (arg) => (typeof arg === 'string' || typeof arg === 'number' ? new Date(arg) : arg),
    z.date(),
  ),
  version: z.number(),
  sellerUuid: z.string(),
  currentBid: z.number(),
});

export type RemoteAuction = z.infer<typeof remoteAuctionSchema>;
