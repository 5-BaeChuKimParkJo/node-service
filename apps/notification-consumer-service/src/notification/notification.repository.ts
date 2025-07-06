import { Injectable } from '@nestjs/common';
import { PrismaService } from 'apps/notification-consumer-service/src/prisma/prisma.service';
import { Prisma } from '../prisma/generated';
import { NotificationsInput, NotificationsOutput } from './schema/notifications.schema';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  createBulk = async (values: Prisma.NotificationCreateManyInput[]) => {
    await this.prisma.notification.createMany({ data: values });
  };

  notifications = async ({ memberUuid, notificationId }: NotificationsInput): Promise<NotificationsOutput> => {
    const limit = 20;
    const pageSize = limit + 1;
    const cursor = notificationId;

    const rows = await this.prisma.notification.findMany({
      where: {
        memberUuid,
        ...(cursor && { notificationId: { lt: cursor } }),
      },
      orderBy: { notificationId: 'desc' },
      take: pageSize,
    });

    const hasNext = rows.length > limit;
    const items = rows.slice(0, limit);
    const nextCursor = hasNext ? { notificationId: items[items.length - 1].notificationId } : null;

    return { items, nextCursor };
  };

  notificationRead = async (memberUuid: string): Promise<void> => {
    await this.prisma.notification.updateMany({
      where: { memberUuid, isRead: false },
      data: { isRead: true },
    });
  };
}
