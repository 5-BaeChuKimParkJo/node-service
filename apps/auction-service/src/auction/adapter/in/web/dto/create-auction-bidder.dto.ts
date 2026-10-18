import { ApiProperty } from '@nestjs/swagger';

export class CreateAuctionBidderRequest {
  @ApiProperty({ type: Number })
  bidAmount!: number;

  @ApiProperty({ type: String })
  requestId!: string;
}
