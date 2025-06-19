import { z } from 'zod';

export const remoteMemberSchema = z.object({
  memberUuid: z.string(),
  nickname: z.string(),
  gradeUuid: z.string(),
  honor: z.enum(['NICE_GUY', 'GOOD_BOY', 'REAL_MAN']),
  state: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']),
  profileImageUrl: z.string().nullable(),
  point: z.number(),
});

export type RemoteMember = z.infer<typeof remoteMemberSchema>;
