import { ApiProperty } from '@nestjs/swagger';

export class AuctionsRequestDto {
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

class AuctionsNextCursorResponseDto {
  @ApiProperty({ type: Date })
  createdAt!: string;

  @ApiProperty({ type: String })
  auctionUuid!: string;
}

class AuctionsImageResponseDto {
  @ApiProperty({ type: Number })
  auctionImageId!: number;

  @ApiProperty({ type: String })
  url!: string;

  @ApiProperty({ type: Number })
  order!: number;
}

class AuctionsItemResponseDto {
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

  @ApiProperty({ type: String })
  sellerUuid!: string;

  @ApiProperty({ type: [Number] })
  tagIds!: number[];

  @ApiProperty({ type: [AuctionsImageResponseDto] })
  images!: AuctionsImageResponseDto[];
}

export class AuctionsResponseDto {
  @ApiProperty({ type: [AuctionsItemResponseDto] })
  items!: AuctionsItemResponseDto[];

  @ApiProperty({ type: AuctionsNextCursorResponseDto, nullable: true })
  nextCursor!: AuctionsNextCursorResponseDto | null;
}
