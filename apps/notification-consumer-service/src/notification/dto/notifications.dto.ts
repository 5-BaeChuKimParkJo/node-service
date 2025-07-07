import { ApiProperty } from '@nestjs/swagger';

export class NotificationsRequestDto {
  @ApiProperty({ required: false, type: Number })
  notificationId?: number;
}

class NotificationsNextCursorResponseDto {
  @ApiProperty({ type: Number })
  notificationId!: number;
}

class NotificationsItemResponseDto {
  @ApiProperty({ type: Number })
  notificationId!: number;

  @ApiProperty({ type: String })
  message!: string;

  @ApiProperty({ type: String })
  type!: string;

  @ApiProperty({ type: Boolean })
  isRead!: boolean;

  @ApiProperty({ type: Date })
  createdAt!: string;
}

export class NotificationsResponseDto {
  @ApiProperty({ type: [NotificationsItemResponseDto] })
  items!: NotificationsItemResponseDto[];

  @ApiProperty({ type: NotificationsNextCursorResponseDto, nullable: true })
  nextCursor!: NotificationsNextCursorResponseDto | null;
}
