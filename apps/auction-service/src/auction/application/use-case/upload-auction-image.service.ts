import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '@app/common';
import { UploadAuctionImageCommand, UploadAuctionImageResponse, UploadAuctionImageUseCase } from '../port/in/upload-auction-image.use-case';
import { AuctionFileStoragePort } from '../port/out/auction-file-storage-port';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class UploadAuctionImageService extends UploadAuctionImageUseCase {
  constructor(private readonly storage: AuctionFileStoragePort) {
    super();
  }

  async execute(command: UploadAuctionImageCommand, _user: User): Promise<UploadAuctionImageResponse> {
    const extension = EXTENSION_BY_CONTENT_TYPE[command.contentType];
    if (!extension) {
      throw new BadRequestException('JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.');
    }
    if (command.bytes.length === 0 || command.bytes.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('이미지는 5MB 이하여야 합니다.');
    }

    const key = `${randomUUID()}.${extension}`;
    await this.storage.putObject({ key, contentType: command.contentType, body: command.bytes });

    return { key, url: this.storage.toFullUrl(key) };
  }
}
