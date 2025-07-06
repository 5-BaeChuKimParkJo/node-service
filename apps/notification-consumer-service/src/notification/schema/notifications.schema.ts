import { z } from 'zod';

export const notificationsInputSchema = z.object({
  notificationId: z.bigint().optional(),
  memberUuid: z.string(),
});

export type NotificationsInput = z.infer<typeof notificationsInputSchema>;

export const notificationsOutputSchema = z.object({
  items: z.array(
    z.object({
      notificationId: z.bigint(),
      message: z.string(),
      type: z.string(),
      isRead: z.boolean(),
      createdAt: z.date(),
    }),
  ),
  nextCursor: z
    .object({
      notificationId: z.bigint(),
    })
    .nullable(),
});

export type NotificationsOutput = z.infer<typeof notificationsOutputSchema>;
