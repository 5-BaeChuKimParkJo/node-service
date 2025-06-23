import { z } from 'zod';

export const sseMessageSchema = z.object({
  memberUuid: z.string(),
  data: z.string(),
});

export type SseMessage = z.infer<typeof sseMessageSchema>;
