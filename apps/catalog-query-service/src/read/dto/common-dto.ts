import { ApiProperty } from '@nestjs/swagger';
import { HttpMember } from '../schema/http-member.schema';

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

export class MemberResponseDto implements HttpMember {
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
