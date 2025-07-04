import { Injectable } from '@nestjs/common';
import { PrismaService } from 'apps/notification-consumer-service/src/prisma/prisma.service';
import { Prisma } from '../prisma/generated';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  createBulk = async (values: Prisma.NotificationCreateManyInput[]) => {
    await this.prisma.notification.createMany({ data: values });
  };

  notifications = async (memberUuid: string) => {
    return this.prisma.notification.findMany({
      where: { memberUuid },
      orderBy: { createdAt: 'desc' },
    });
  };
}
