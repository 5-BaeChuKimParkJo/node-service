import { ApiProperty } from '@nestjs/swagger';

export class AuctionsRequest {
  @ApiProperty({
    required: false,
    type: Date,
    description: '`auctionUuid`와 `createdAt`는 둘 다 있거나 둘 다 없어야 합니다.',
  })
  createdAt?: string;

  @ApiProperty({
    required: false,
    type: String,
    description: '`auctionUuid`와 `createdAt`는 둘 다 있거나 둘 다 없어야 합니다.',
  })
  auctionUuid?: string;
}

class AuctionsNextCursorResponse {
  @ApiProperty({ type: Date })
  createdAt!: string;

  @ApiProperty({ type: String })
  auctionUuid!: string;
}

class AuctionsImageResponse {
  @ApiProperty({ type: Number })
  auctionImageId!: number;

  @ApiProperty({ type: String })
  url!: string;

  @ApiProperty({ type: Number })
  order!: number;
}

class AuctionsItemResponse {
  @ApiProperty({ type: String })
  auctionUuid!: string;

  @ApiProperty({ required: false, type: Number, nullable: true })
  categoryId?: number | null;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: Number })
  minimumBid!: number;

  @ApiProperty({ type: Date })
  startAt!: string;

  @ApiProperty({ type: Date })
  endAt!: string;

  @ApiProperty({ type: Boolean })
  isDirectDeal!: boolean;

  @ApiProperty({ required: false, type: String, nullable: true })
  directDealLocation?: string | null;

  @ApiProperty({ enum: ['waiting', 'active', 'ended', 'hidden', 'cancelled'] })
  status!: 'waiting' | 'active' | 'ended' | 'hidden' | 'cancelled';

  @ApiProperty({ enum: ['unopened', 'new', 'used'] })
  productCondition!: 'unopened' | 'new' | 'used';

  @ApiProperty({ type: Number })
  viewCount!: number;

  @ApiProperty({ type: String })
  thumbnailUrl!: string;

  @ApiProperty({ type: Date })
  createdAt!: string;

  @ApiProperty({ type: Date, nullable: true })
  soldAt!: string | null;

  @ApiProperty({ type: String })
  sellerUuid!: string;

  @ApiProperty({ type: [Number] })
  tagIds!: number[];

  @ApiProperty({ type: [AuctionsImageResponse] })
  images!: AuctionsImageResponse[];
}

export class AuctionsResponse {
  @ApiProperty({ type: [AuctionsItemResponse] })
  items!: AuctionsItemResponse[];

  @ApiProperty({ type: AuctionsNextCursorResponse, nullable: true })
  nextCursor!: AuctionsNextCursorResponse | null;
}
