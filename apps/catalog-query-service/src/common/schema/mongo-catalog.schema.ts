import { z } from 'zod';
import { httpCategorySchema } from './http-category.schema';
import { httpTagSchema } from './http-tag.schema';

export const mongoCatalogTypeAuctionSchema = z.object({
  type: z.enum(['auction']),
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
  soldAt: z.preprocess(
    (arg) => (typeof arg === 'string' || typeof arg === 'number' ? new Date(arg) : arg),
    z.date().nullable().optional(),
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
  category: httpCategorySchema.nullable(),
  tags: z.array(httpTagSchema),
});
export type MongoCatalogTypeAuction = z.infer<typeof mongoCatalogTypeAuctionSchema>;

export const mongoCatalogTypeProductSchema = z.object({
  type: z.enum(['product']),
  id: z.number(),
  productUuid: z.string().uuid(),
  saleMemberUuid: z.string().uuid(),
  title: z.string(),
  categoryId: z.string(),
  description: z.string(),
  productCondition: z.enum(['UNOPENED', 'NEW', 'USED']),
  isDirectDeal: z.boolean(),
  directDealLocation: z.string().nullable(),
  isHide: z.boolean(),
  status: z.enum(['ACTIVE', 'DEALING', 'ENDED']),
  thumbnailKey: z.string().nullable(),
  viewCount: z.number(),
  price: z.number(),
  ticketUuid: z.string().nullable(),
  imageList: z.null(),
  imageUrlList: z.array(
    z.object({
      productImageId: z.number(),
      url: z.string().url(),
      order: z.number(),
    }),
  ),
  tagIdList: z.array(z.number()),
  isDeleted: z.boolean(),
  createdAt: z.preprocess(
    (arg) => (typeof arg === 'string' || typeof arg === 'number' ? new Date(arg) : arg),
    z.date(),
  ),
  category: httpCategorySchema,
  tags: z.array(httpTagSchema),
});
export type MongoCatalogTypeProduct = z.infer<typeof mongoCatalogTypeProductSchema>;

export const mongoCatalogSchema = z.union([mongoCatalogTypeAuctionSchema, mongoCatalogTypeProductSchema]);

export type MongoCatalog = z.infer<typeof mongoCatalogSchema>;
