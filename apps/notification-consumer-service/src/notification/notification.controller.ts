import { Controller, Get, Post, Query, Version } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { NotificationsRequest, NotificationsResponse } from './dto/notifications.dto';
import { NotificationMapper } from './mapper/notification.mapper';
import { JwtUser } from '@app/common/decorator/jwt-user.decorator';
import { User } from '@app/common/types/user';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Version('1')
  @Get()
  @ApiBearerAuth()
  @ApiOkResponse({ type: NotificationsResponse })
  async notificationsV1(
    @JwtUser() user: User,
    @Query() requestDto: NotificationsRequest,
  ): Promise<NotificationsResponse> {
    const input = NotificationMapper.fromRequestDto(requestDto, user);
    const output = await this.notificationService.notifications(input);
    return NotificationMapper.toResponseDto(output);
  }

  @Version('1')
  @Post('/read')
  @ApiBearerAuth()
  async notificationReadV1(@JwtUser() user: User): Promise<void> {
    await this.notificationService.notificationRead(user);
  }
}
