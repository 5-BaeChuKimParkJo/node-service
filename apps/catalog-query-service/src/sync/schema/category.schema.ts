import { z } from 'zod';

export const categorySchema = z.object({
  categoryId: z.number(),
  name: z.string(),
  description: z.string(),
  imageUrl: z.string().nullish(),
});

export type Category = z.infer<typeof categorySchema>;
