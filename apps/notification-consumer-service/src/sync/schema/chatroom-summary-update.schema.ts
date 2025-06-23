import { z } from 'zod';

export const chatroomSummaryUpdateValueSchema = z.object({
  chatRoomUuid: z.string(),
  targetMemberUuids: z.array(z.string()),
  eventType: z.enum(['READ_UPDATE', 'MESSAGE_UPDATE']),
});

export type ChatroomSummaryUpdateValue = z.infer<typeof chatroomSummaryUpdateValueSchema>;
