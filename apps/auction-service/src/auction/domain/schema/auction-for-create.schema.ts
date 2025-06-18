import { z } from 'zod';
import { auctionPropsSchema } from './auction.schema';

export const auctionForCreatePropsSchema = auctionPropsSchema
  .pick({
    title: true,
    description: true,
    minimumBid: true,
    startAt: true,
    endAt: true,
    isDirectDeal: true,
    productCondition: true,
    currentBid: true,
    thumbnailKey: true,
    sellerUuid: true,
    tagIds: true,
  })
  .merge(
    auctionPropsSchema
      .pick({
        categoryId: true,
        directDealLocation: true,
      })
      .partial(),
  )
  .merge(
    z.object({
      images: z
        .object({
          key: z.string(),
          order: z.number(),
        })
        .array(),
      status: z.literal('visible'),
    }),
  )
  .strip();
