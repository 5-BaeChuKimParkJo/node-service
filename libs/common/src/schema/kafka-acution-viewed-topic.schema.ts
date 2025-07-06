import { z } from 'zod';

export const kafkaAuctionViewedTopicValueSchema = z.object({
  auctionUuid: z.string(),
  viewerUuid: z.string(),
});

export type KafkaAuctionViewedTopicValue = z.infer<typeof kafkaAuctionViewedTopicValueSchema>;
