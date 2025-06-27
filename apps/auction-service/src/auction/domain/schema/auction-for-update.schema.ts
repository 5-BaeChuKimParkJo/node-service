import { z } from 'zod';
import { auctionPropsSchema } from './auction.schema';

export const auctionForUpdatePropsSchema = auctionPropsSchema
  .pick({
    auctionUuid: true,
  })
  .merge(
    auctionPropsSchema
      .pick({
        title: true,
        description: true,
        minimumBid: true,
        startAt: true,
        endAt: true,
        isDirectDeal: true,
        productCondition: true,
        thumbnailKey: true,
        status: true,
        categoryId: true,
        directDealLocation: true,
        tagIds: true,
        soldAt: true,
      })
      .merge(
        z.object({
          images: z
            .object({
              key: z.string(),
              order: z.number(),
            })
            .array(),
        }),
      )
      .partial(),
  )
  .strip();
