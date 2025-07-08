import { z } from 'zod';

export const httpCategorySchema = z.object({
  categoryId: z.number(),
  name: z.string(),
  description: z.string(),
  imageUrl: z.string().nullish(),
});

export type HttpCategory = z.infer<typeof httpCategorySchema>;
