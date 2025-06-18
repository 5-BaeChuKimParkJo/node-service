import { ApiProperty } from '@nestjs/swagger';

export class AuctionsByIdsRequestDto {
  @ApiProperty({ type: [String] })
  ids!: string[];
}

class AuctionsByIdsImageResponseDto {
  @ApiProperty({ type: Number })
  auctionImageId!: number;

  @ApiProperty({ type: String })
  url!: string;

  @ApiProperty({ type: Number })
  order!: number;
}

export class AuctionsByIdsItemResponseDto {
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

  @ApiProperty({ type: [AuctionsByIdsImageResponseDto] })
  images!: AuctionsByIdsImageResponseDto[];
}
