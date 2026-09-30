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

const SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  'image/jpeg': (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
  'image/webp': (bytes) =>
    bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP',
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
    if (!SIGNATURES[command.contentType](command.bytes)) {
      throw new BadRequestException('이미지 형식과 파일 내용이 일치하지 않습니다.');
    }

    const key = `${_user.memberUuid}_${randomUUID()}.${extension}`;
    await this.storage.putObject({ key, contentType: command.contentType, body: command.bytes });

    return { key, url: this.storage.toFullUrl(key) };
  }
}
