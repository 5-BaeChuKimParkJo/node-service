import { z } from 'zod';

const AuctionImagesSchema = z.object({
  auctionImageId: z.number(),
  url: z.string(),
  order: z.number(),
});

const CategorySchema = z.object({
  categoryId: z.number(),
  name: z.string(),
  description: z.string(),
  imageUrl: z.string().nullable().optional(),
});

const TagSchema = z.object({
  tagId: z.number(),
  name: z.string(),
});

const MemberSchema = z.object({
  memberUuid: z.string(),
  nickname: z.string(),
  gradeUuid: z.string(),
  honor: z.enum(['NICE_GUY', 'GOOD_BOY', 'REAL_MAN']).nullable(),
  state: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']),
  profileImageUrl: z.string().nullable(),
  point: z.number().nullable(),
});

export const HttpAuctionSchema = z.object({
  type: z.literal('auction'),
  auctionUuid: z.string(),
  title: z.string(),
  description: z.string(),
  minimumBid: z.number(),
  startAt: z.string(),
  endAt: z.string(),
  isDirectDeal: z.boolean(),
  directDealLocation: z.string().nullable().optional(),
  productCondition: z.enum(['unopened', 'new', 'used']),
  viewCount: z.number(),
  thumbnailUrl: z.string(),
  createdAt: z.string(),
  soldAt: z.string().nullable(),
  version: z.number(),
  currentBid: z.number(),
  status: z.enum(['waiting', 'active', 'ended']),
  category: CategorySchema.nullable(),
  tags: z.array(TagSchema),
  seller: MemberSchema,
  images: z.array(AuctionImagesSchema),
});

export type HttpAuction = z.infer<typeof HttpAuctionSchema>;
