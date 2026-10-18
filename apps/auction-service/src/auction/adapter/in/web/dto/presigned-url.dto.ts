import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlRequest {
  @ApiProperty({ enum: ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'] })
  contentType!: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/bmp';
}

export class PresignedUrlResponse {
  @ApiProperty({ type: String })
  url!: string;

  @ApiProperty({ type: Object })
  fields!: Record<string, string>;
}
