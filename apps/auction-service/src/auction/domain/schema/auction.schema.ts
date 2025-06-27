import { isTimeTruncated } from '@app/common';
import { z } from 'zod';

export const auctionPropsSchema = z
  .object({
    auctionId: z.bigint(),
    auctionUuid: z.string().uuid({ message: '경매 UUID의 형식이 올바르지 않습니다.' }),
    categoryId: z.number().nullable(),
    title: z
      .string()
      .min(5, { message: '제목을 5~100자로 입력해 주세요' })
      .max(100, { message: '제목을 5~100자로 입력해 주세요' }),
    description: z.string().max(1000, { message: '내용을 1000자 이내로 입력해 주세요' }),
    minimumBid: z.bigint(),
    currentBid: z.bigint(),
    currentBidderUuid: z.string().uuid({ message: 'UUID의 형식이 올바르지 않습니다.' }).nullable(),
    startAt: z.date().refine(isTimeTruncated, {
      message: '경매 시작시각은 정각이어야 합니다.',
    }),
    endAt: z.date().refine(isTimeTruncated, {
      message: '경매 종료시각은 정각이어야 합니다.',
    }),
    isDirectDeal: z.boolean(),
    directDealLocation: z.string().nullable(),
    status: z.enum(['visible']),
    productCondition: z.enum(['unopened', 'new', 'used']),
    viewCount: z.bigint(),
    thumbnailKey: z.string(),
    createdAt: z.date(),
    soldAt: z.date().nullable(),
    sellerUuid: z.string().uuid({ message: '경매 UUID의 형식이 올바르지 않습니다.' }),
    tagIds: z.array(z.number()),
    version: z.number(),
    images: z
      .object({
        auctionImageId: z.bigint(),
        key: z.string(),
        order: z.number(),
      })
      .array(),
  })
  .strip();
