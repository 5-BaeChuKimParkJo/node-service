import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto, MemberResponseDto, TagResponseDto } from './common-dto';

class ProductImageResponseDto {
  @ApiProperty({ type: Number })
  productImageId!: number;

  @ApiProperty({ type: String })
  url!: string;

  @ApiProperty({ type: Number })
  order!: number;
}

export class ProductResponseDto {
  @ApiProperty({ enum: ['product'] })
  type!: 'product';

  @ApiProperty({ type: Number })
  id!: number;

  @ApiProperty({ type: String })
  productUuid!: string;

  @ApiProperty({ type: String })
  saleMemberUuid!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  categoryId!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ enum: ['UNOPENED', 'NEW', 'USED'] })
  productCondition!: 'UNOPENED' | 'NEW' | 'USED';

  @ApiProperty({ type: Boolean })
  isDirectDeal!: boolean;

  @ApiProperty({ type: String, nullable: true })
  directDealLocation!: string | null;

  @ApiProperty({ type: Boolean })
  isHide!: boolean;

  @ApiProperty({ enum: ['ACTIVE', 'DEALING', 'ENDED'] })
  status!: 'ACTIVE' | 'DEALING' | 'ENDED';

  @ApiProperty({ type: String, nullable: true })
  thumbnailKey!: string | null;

  @ApiProperty({ type: Number })
  viewCount!: number;

  @ApiProperty({ type: Number })
  price!: number;

  @ApiProperty({ type: String, nullable: true })
  ticketUuid!: string | null;

  @ApiProperty({ type: [Number] })
  tagIdList!: number[];

  @ApiProperty({ type: Boolean })
  isDeleted!: boolean;

  @ApiProperty({ type: Date })
  createdAt!: string;

  @ApiProperty({ type: CategoryResponseDto })
  category!: CategoryResponseDto;

  @ApiProperty({ type: [TagResponseDto] })
  tags!: TagResponseDto[];

  @ApiProperty({ type: MemberResponseDto })
  seller!: MemberResponseDto;

  @ApiProperty({ type: [ProductImageResponseDto] })
  imageUrlList!: ProductImageResponseDto[];
}
