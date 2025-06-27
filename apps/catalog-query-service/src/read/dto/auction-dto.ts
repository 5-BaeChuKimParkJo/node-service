import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto, MemberResponseDto, TagResponseDto } from './common-dto';

class AuctionImageResponseDto {
  @ApiProperty({ type: Number })
  auctionImageId!: number;

  @ApiProperty({ type: String })
  url!: string;

  @ApiProperty({ type: Number })
  order!: number;
}

export class AuctionResponseDto {
  @ApiProperty({ enum: ['auction'] })
  type!: 'auction';

  @ApiProperty({ type: String })
  auctionUuid!: string;

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

  @ApiProperty({ type: Number })
  version!: number;

  @ApiProperty({ type: Number })
  currentBid!: number;

  @ApiProperty({ enum: ['waiting', 'active', 'ended'] })
  status!: 'waiting' | 'active' | 'ended';

  @ApiProperty({ type: CategoryResponseDto, nullable: true })
  category!: CategoryResponseDto | null;

  @ApiProperty({ type: [TagResponseDto] })
  tags!: TagResponseDto[];

  @ApiProperty({ type: MemberResponseDto })
  seller!: MemberResponseDto;

  @ApiProperty({ type: [AuctionImageResponseDto] })
  images!: AuctionImageResponseDto[];
}
