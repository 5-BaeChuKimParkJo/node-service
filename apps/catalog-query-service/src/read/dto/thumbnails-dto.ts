import { ApiProperty } from '@nestjs/swagger';

export class ThumbnailsRequestDto {
  @ApiProperty({ type: [String] })
  ids!: string[];
}

export class ThumbnailsResponseDto {
  @ApiProperty({ enum: ['auction', 'product'] })
  type!: 'auction' | 'product';

  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  thumbnailUrl!: string;
}
