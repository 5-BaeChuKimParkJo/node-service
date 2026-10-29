import { z } from 'zod';
import { auctionPropsSchema } from './auction.schema';
import { isTimeTruncated } from '@app/common/utils/date.utils';

export const demoAuctionForCreatePropsSchema = auctionPropsSchema
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

export const auctionForCreatePropsSchema = demoAuctionForCreatePropsSchema.extend({
  startAt: z.date().refine(isTimeTruncated, { message: '경매 시작시각은 정각이어야 합니다.' }),
  endAt: z.date().refine(isTimeTruncated, { message: '경매 종료시각은 정각이어야 합니다.' }),
});
