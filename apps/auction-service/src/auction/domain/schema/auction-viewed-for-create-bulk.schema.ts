import { z } from 'zod';

export const auctionViewedForCreateBulkPropsSchema = z
  .object({
    auctionUuid: z.string().uuid({ message: '경매 UUID의 형식이 올바르지 않습니다.' }),
    viewerUuid: z.string().uuid({ message: 'UUID의 형식이 올바르지 않습니다.' }),
    viewedAt: z.date(),
  })
  .strip();
