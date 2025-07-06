import { z } from 'zod';

export const commonMessageValueSchema = z.object({
  type: z.string(),
  message: z.string(),
  memberUuids: z.string().array(),
  data: z.record(z.string(), z.any()),
});

export type CommonMessageValue = z.infer<typeof commonMessageValueSchema>;
