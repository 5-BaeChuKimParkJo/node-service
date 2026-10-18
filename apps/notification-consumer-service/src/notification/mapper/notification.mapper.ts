import { toNumber } from '@app/common/utils/number.utils';
import { User } from '@app/common/types/user';
import { NotificationsRequest, NotificationsResponse } from '../dto/notifications.dto';
import { NotificationsInput, NotificationsOutput } from '../schema/notifications.schema';

export class NotificationMapper {
  static fromRequestDto = (requestDto: NotificationsRequest, user: User): NotificationsInput => {
    return {
      notificationId: requestDto.notificationId ? BigInt(requestDto.notificationId) : undefined,
      memberUuid: user.memberUuid,
    };
  };

  static toResponseDto = ({ items, nextCursor }: NotificationsOutput): NotificationsResponse => {
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
