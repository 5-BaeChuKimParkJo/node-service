import { toNumber, User } from '@app/common';
import { NotificationsRequestDto, NotificationsResponseDto } from '../dto/notifications.dto';
import { NotificationsInput, NotificationsOutput } from '../schema/notifications.schema';

export class NotificationMapper {
  static fromRequestDto = (requestDto: NotificationsRequestDto, user: User): NotificationsInput => {
    return {
      notificationId: requestDto.notificationId ? BigInt(requestDto.notificationId) : undefined,
      memberUuid: user.memberUuid,
    };
  };

  static toResponseDto = ({ items, nextCursor }: NotificationsOutput): NotificationsResponseDto => {
    return {
      items: items.map((item) => ({
        ...item,
        notificationId: toNumber(item.notificationId),
        createdAt: item.createdAt.toISOString(),
      })),
      nextCursor: nextCursor
        ? {
            notificationId: toNumber(nextCursor.notificationId),
          }
        : null,
    };
  };
}
