import { ApiProperty } from '@nestjs/swagger';

export class AuctionResponseDto {
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

  @ApiProperty({ type: String, nullable: true })
  directDealLocation!: string | null;

  @ApiProperty({ type: String })
  productCondition!: string;

  @ApiProperty({ type: Number })
  viewCount!: number;

  @ApiProperty({ type: String })
  thumbnailUrl!: string;

  @ApiProperty({ type: Date })
  createdAt!: string;

  @ApiProperty({ type: Number })
  version!: number;

  @ApiProperty({ type: Number })
  currentBid!: number;
}

export class CategoryResponseDto {
  @ApiProperty({ type: Number })
  categoryId!: number;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: String, nullable: true })
  imageUrl?: string | null;
}

export class TagResponseDto {
  @ApiProperty({ type: Number })
  tagId!: number;

  @ApiProperty({ type: String })
  name!: string;
}

export class MemberResponseDto {
  @ApiProperty({ type: String })
  memberUuid!: string;

  @ApiProperty({ type: String })
  nickname!: string;

  @ApiProperty({ type: String })
  gradeUuid!: string;

  @ApiProperty({ enum: ['NICE_GUY', 'GOOD_BOY', 'REAL_MAN'], nullable: true })
  honor?: string | null;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'] })
  state!: string;

  @ApiProperty({ type: String, nullable: true })
  profileImageUrl?: string | null;
}

export class CatalogAuctionResponseDto extends AuctionResponseDto {
  @ApiProperty({ enum: ['auction'] })
  type!: 'auction';

  @ApiProperty({ type: CategoryResponseDto, nullable: true })
  category!: CategoryResponseDto | null;

  @ApiProperty({ type: [TagResponseDto] })
  tags!: TagResponseDto[];

  @ApiProperty({ type: MemberResponseDto })
  seller!: MemberResponseDto;
}
