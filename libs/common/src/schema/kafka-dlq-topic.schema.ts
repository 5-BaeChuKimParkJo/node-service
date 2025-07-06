import { z } from 'zod';

export const kafkaDlqTopicValueSchema = z.object({
  startOffset: z.string().nullable(),
  lastOffset: z.string(),
  partition: z.number(),
  topic: z.string(),
  error: z.string(),
  timestamp: z.date(),
});

export type KafkaDlqTopicValue = z.infer<typeof kafkaDlqTopicValueSchema>;
