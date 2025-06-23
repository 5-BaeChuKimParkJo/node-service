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
  status: z.enum(['visible']),
  productCondition: z.enum(['unopened', 'new', 'used']),
  viewCount: z.number(),
  thumbnailUrl: z.string(),
  createdAt: z.preprocess(
    (arg) => (typeof arg === 'string' || typeof arg === 'number' ? new Date(arg) : arg),
    z.date(),
  ),
  images: z.array(
    z.object({
      auctionImageId: z.number(),
      url: z.string(),
      order: z.number(),
    }),
  ),
  version: z.number(),
  sellerUuid: z.string(),
  currentBid: z.number(),
});

export type RemoteAuction = z.infer<typeof remoteAuctionSchema>;
