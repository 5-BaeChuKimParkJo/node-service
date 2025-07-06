import { z } from 'zod';

export const httpMemberSchema = z.object({
  memberUuid: z.string(),
  nickname: z.string(),
  gradeUuid: z.string(),
  honor: z.enum(['NICE_GUY', 'GOOD_BOY', 'REAL_MAN']).nullable(),
  state: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']),
  profileImageUrl: z.string().nullable().nullable(),
  point: z.number().nullable(),
});

export type HttpMember = z.infer<typeof httpMemberSchema>;
