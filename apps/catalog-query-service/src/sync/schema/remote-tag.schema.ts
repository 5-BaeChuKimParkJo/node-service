import { z } from 'zod';

export const remoteTagSchema = z.object({
  tagId: z.number(),
  name: z.string(),
});

export type RemoteTag = z.infer<typeof remoteTagSchema>;
