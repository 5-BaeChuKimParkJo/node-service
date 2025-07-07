import { ApiProperty } from '@nestjs/swagger';

class MyBidAuctionImagesResponseDto {
  @ApiProperty({ type: Number })
  auctionImageId!: number;

  @ApiProperty({ type: String })
  url!: string;

  @ApiProperty({ type: Number })
  order!: number;
}

class MyBidCategoryResponseDto {
  @ApiProperty({ type: Number })
  categoryId!: number;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: String, nullable: true })
  imageUrl?: string | null;
}

class MyBidTagResponseDto {
  @ApiProperty({ type: Number })
  tagId!: number;

  @ApiProperty({ type: String })
  name!: string;
}

class MyBidMemberResponseDto {
  @ApiProperty({ type: String })
  memberUuid!: string;

  @ApiProperty({ type: String })
  nickname!: string;

  @ApiProperty({ type: String })
  gradeUuid!: string;

  @ApiProperty({ enum: ['NICE_GUY', 'GOOD_BOY', 'REAL_MAN'], nullable: true })
  honor!: 'NICE_GUY' | 'GOOD_BOY' | 'REAL_MAN' | null;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'] })
  state!: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

  @ApiProperty({ type: String, nullable: true })
  profileImageUrl!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  point!: number | null;
}

class MyBidsAuctionResponseDto {
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

  @ApiProperty({ type: MyBidCategoryResponseDto, nullable: true })
  category!: MyBidCategoryResponseDto | null;

  @ApiProperty({ type: [MyBidTagResponseDto] })
  tags!: MyBidTagResponseDto[];

  @ApiProperty({ type: MyBidMemberResponseDto })
  seller!: MyBidMemberResponseDto;

  @ApiProperty({ type: [MyBidAuctionImagesResponseDto] })
  images!: MyBidAuctionImagesResponseDto[];
}

class MyBidsAuctionBidderResponseDto {
  @ApiProperty({ type: String })
  bidderUuid!: string;

  @ApiProperty({ type: Number })
  bidAmount!: number;

  @ApiProperty({ type: Date })
  createdAt!: string;
}

export class MyBidsResponseDto {
  @ApiProperty({ type: MyBidsAuctionBidderResponseDto })
  bidder!: MyBidsAuctionBidderResponseDto;

  @ApiProperty({ type: MyBidsAuctionResponseDto })
  auction!: MyBidsAuctionResponseDto;
}
