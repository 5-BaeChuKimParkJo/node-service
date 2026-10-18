import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponse, MemberResponse, TagResponse } from './common-dto';

class AuctionImageResponse {
  @ApiProperty({ type: Number })
  auctionImageId!: number;

  @ApiProperty({ type: String })
  url!: string;

  @ApiProperty({ type: Number })
  order!: number;
}

export class AuctionResponse {
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

  @ApiProperty({ type: CategoryResponse, nullable: true })
  category!: CategoryResponse | null;

  @ApiProperty({ type: [TagResponse] })
  tags!: TagResponse[];

  @ApiProperty({ type: MemberResponse })
  seller!: MemberResponse;

  @ApiProperty({ type: [AuctionImageResponse] })
  images!: AuctionImageResponse[];
}
