import { ApiProperty } from '@nestjs/swagger';

export class NotificationsRequest {
  @ApiProperty({ required: false, type: Number })
  notificationId?: number;
}

class NotificationsNextCursorResponse {
  @ApiProperty({ type: Number })
  notificationId!: number;
}

class NotificationsItemResponse {
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

export class NotificationsResponse {
  @ApiProperty({ type: [NotificationsItemResponse] })
  items!: NotificationsItemResponse[];

  @ApiProperty({ type: NotificationsNextCursorResponse, nullable: true })
  nextCursor!: NotificationsNextCursorResponse | null;
}
