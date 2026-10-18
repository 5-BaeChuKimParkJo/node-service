import { ApiProperty } from '@nestjs/swagger';

export class AuctionBiddersRequest {
  @ApiProperty({
    required: false,
    type: Date,
    description: '`bidAmount`와 `createdAt`는 둘 다 있거나 둘 다 없어야 합니다.',
  })
  createdAt?: string;

  @ApiProperty({
    required: false,
    type: Number,
    description: '`bidAmount`와 `createdAt`는 둘 다 있거나 둘 다 없어야 합니다.',
  })
  bidAmount?: number;
}

class AuctionBiddersNextCursorResponse {
  @ApiProperty({ type: Date })
  createdAt!: string;

  @ApiProperty({ type: Number })
  bidAmount!: number;
}

class AuctionBiddersItemResponse {
  @ApiProperty({ type: String })
  auctionUuid!: string;

  @ApiProperty({ type: String })
  bidderUuid!: string;

  @ApiProperty({ type: Number })
  bidAmount!: number;

  @ApiProperty({ type: Date })
  createdAt!: string;
}

export class AuctionBiddersResponse {
  @ApiProperty({ type: [AuctionBiddersItemResponse] })
  items!: AuctionBiddersItemResponse[];

  @ApiProperty({ type: AuctionBiddersNextCursorResponse, nullable: true })
  nextCursor!: AuctionBiddersNextCursorResponse | null;
}
