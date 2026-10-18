import { ApiProperty } from '@nestjs/swagger';

export class ThumbnailsRequest {
  @ApiProperty({ type: [String] })
  ids!: string[];
}

export class ThumbnailsResponse {
  @ApiProperty({ enum: ['auction', 'product'] })
  type!: 'auction' | 'product';

  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  thumbnailUrl!: string;
}
