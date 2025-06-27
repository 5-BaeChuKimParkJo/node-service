import { z } from 'zod';

export const httpTagSchema = z.object({
  tagId: z.number(),
  name: z.string(),
});

export type HttpTag = z.infer<typeof httpTagSchema>;
