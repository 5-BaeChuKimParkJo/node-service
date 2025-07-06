import { Controller, Get, Post, Query, Version } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { NotificationsRequestDto, NotificationsResponseDto } from './dto/notifications.dto';
import { NotificationMapper } from './mapper/notification.mapper';
import { JwtUser, User } from '@app/common';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Version('1')
  @Get()
  @ApiBearerAuth()
  @ApiOkResponse({ type: NotificationsResponseDto })
  async notificationsV1(
    @JwtUser() user: User,
    @Query() requestDto: NotificationsRequestDto,
  ): Promise<NotificationsResponseDto> {
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
