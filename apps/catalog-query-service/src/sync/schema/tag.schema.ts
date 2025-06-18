import { z } from 'zod';

export const tagSchema = z.object({
  tagId: z.number(),
  name: z.string(),
});

export type Tag = z.infer<typeof tagSchema>;
