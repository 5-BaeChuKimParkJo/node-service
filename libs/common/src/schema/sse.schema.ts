import { z } from 'zod';

export const sseMessageSchema = z.object({
  /** 메시지를 보내기 위한 대상 유저의 고유 식별자 */
  memberUuid: z.string(),
  /** 메시지 내용 */
  data: z.string(),
});

export type SseMessage = z.infer<typeof sseMessageSchema>;
