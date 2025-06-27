import { z } from 'zod';

export const thumbnailSchema = z
  .object({
    type: z.enum(['auction', 'product']),
    id: z.string(),
    thumbnailUrl: z.string(),
  })
  .strip();

export type Thumbnail = z.infer<typeof thumbnailSchema>;
