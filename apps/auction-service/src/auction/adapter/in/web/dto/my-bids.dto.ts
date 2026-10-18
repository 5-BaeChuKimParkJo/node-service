import { ApiProperty } from '@nestjs/swagger';

export class MyBidsResponse {
  @ApiProperty({ type: String })
  auctionUuid!: string;

  @ApiProperty({ type: String })
  bidderUuid!: string;

  @ApiProperty({ type: Number })
  bidAmount!: number;

  @ApiProperty({ type: Date })
  createdAt!: string;
}
