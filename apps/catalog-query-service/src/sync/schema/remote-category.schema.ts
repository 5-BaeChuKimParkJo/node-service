import { z } from 'zod';

export const remoteCategorySchema = z.object({
  categoryId: z.number(),
  name: z.string(),
  description: z.string(),
  imageUrl: z.string().nullish(),
});

export type RemoteCategory = z.infer<typeof remoteCategorySchema>;
