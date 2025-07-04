import { Injectable } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';

@Injectable()
export class NotificationService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  notifications = async (memberUuid: string) => {
    return this.notificationRepository.notifications(memberUuid);
  };
}
