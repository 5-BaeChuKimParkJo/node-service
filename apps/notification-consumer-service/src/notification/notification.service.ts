import { Injectable } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import { NotificationsInput, NotificationsOutput } from './schema/notifications.schema';
import { User } from '@app/common';

@Injectable()
export class NotificationService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  notifications = async (input: NotificationsInput): Promise<NotificationsOutput> => {
    return this.notificationRepository.notifications(input);
  };

  notificationRead = async (user: User): Promise<void> => {
    return this.notificationRepository.notificationRead(user.memberUuid);
  };
}
