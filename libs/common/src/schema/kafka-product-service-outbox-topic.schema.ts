import { z } from 'zod';

export const kafkaProductServiceOutboxTopicValueSchema = z.object({
  aggregate_type: z.string(),
  aggregate_id: z.number(),
  event_type: z.enum(['ProductCreate', 'ProductUpdate', 'ProductDelete']),
  op: z.enum(['c', 'u', 'd']),
  payload: z.preprocess(
    (val) => JSON.parse(String(val ?? {})),
    z
      .object({
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
      })
      .strip(),
  ),
});
export type KafkaProductServiceOutboxTopicValue = z.infer<typeof kafkaProductServiceOutboxTopicValueSchema>;
