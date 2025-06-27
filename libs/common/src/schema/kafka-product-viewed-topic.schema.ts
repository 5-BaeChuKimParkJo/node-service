import { z } from 'zod';

export const kafkaProductViewedTopicValueSchema = z.object({
  productUuid: z.string(),
  viewerUuid: z.string(),
});

export type KafkaProductViewedTopicValue = z.infer<typeof kafkaProductViewedTopicValueSchema>;
