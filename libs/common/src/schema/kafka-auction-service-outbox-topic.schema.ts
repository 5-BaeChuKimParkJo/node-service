import { z } from 'zod';

export const kafkaAuctionServiceOutboxTopicValueSchema = z.object({
  aggregateType: z.string(),
  aggregateId: z.string(),
  eventType: z.enum(['AuctionCreated', 'AuctionUpdated', 'AuctionDeleted']),
  op: z.enum(['c', 'u', 'd']),
  payload: z.preprocess(
    (val) => JSON.parse(String(val ?? {})),
    z
      .object({
        auctionUuid: z.string(),
        categoryId: z.number().nullable(),
        title: z.string(),
        description: z.string(),
        minimumBid: z.number(),
        startAt: z.preprocess(
          (arg) => (typeof arg === 'string' || typeof arg === 'number' ? new Date(arg) : arg),
          z.date(),
        ),
        endAt: z.preprocess(
          (arg) => (typeof arg === 'string' || typeof arg === 'number' ? new Date(arg) : arg),
          z.date(),
        ),
        isDirectDeal: z.boolean(),
        directDealLocation: z.string().nullable(),
        viewCount: z.number(),
        thumbnailUrl: z.string(),
        createdAt: z.preprocess(
          (arg) => (typeof arg === 'string' || typeof arg === 'number' ? new Date(arg) : arg),
          z.date(),
        ),
        version: z.number(),
        sellerUuid: z.string(),
        currentBid: z.number(),
        tagIds: z.array(z.number()),
        status: z.enum(['visible']),
        soldAt: z.preprocess(
          (arg) => (typeof arg === 'string' || typeof arg === 'number' ? new Date(arg) : arg),
          z.date().nullable(),
        ),
        productCondition: z.enum(['unopened', 'new', 'used']),
        images: z.array(
          z.object({
            auctionImageId: z.number(),
            url: z.string(),
            order: z.number(),
          }),
        ),
      })
      .strip(),
  ),
});
export type KafkaAuctionServiceOutboxTopicValue = z.infer<typeof kafkaAuctionServiceOutboxTopicValueSchema>;
