import { ApiProperty } from '@nestjs/swagger';

export class AuctionAdminListRequestDto {
  @ApiProperty({ required: false })
  query?: string;

  @ApiProperty({ required: false, enum: ['waiting', 'active', 'ended', 'hidden', 'cancelled'] })
  status?: string;

  @ApiProperty({ required: false })
  createdAt?: string;

  @ApiProperty({ required: false })
  auctionUuid?: string;
}

export class AuctionAdminActionRequestDto {
  @ApiProperty({ enum: ['hide', 'restore', 'force-end'] })
  action!: string;

  @ApiProperty({ minLength: 1, maxLength: 500 })
  reason!: string;
}

export class AuctionAdminBidsRequestDto {
  @ApiProperty({ required: false, format: 'date-time' })
  createdAt?: string;

  @ApiProperty({ required: false, format: 'uuid' })
  auctionBidderUuid?: string;
}
