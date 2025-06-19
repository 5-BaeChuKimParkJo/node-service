import { Injectable } from '@nestjs/common';
import { PresignedUrlUseCase } from '../port/in/presigned-url.use-case';
import { AuctionFileStoragePort } from '../port/out/auction-file-storage-port';
import { PresignedUrlCommand } from '../port/dto/presigned-url.command';
import { PresignedUrlResponse } from '../port/dto/presigned-url.response';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime';
import { ErrorCode, User, AppException } from '@app/common';

@Injectable()
export class PresignedUrlService extends PresignedUrlUseCase {
  constructor(private readonly auctionFileStoragePort: AuctionFileStoragePort) {
    super();
  }

  override execute = async (command: PresignedUrlCommand, user: User): Promise<PresignedUrlResponse> => {
    const ext = mime.getExtension(command.contentType);
    if (!ext) {
      throw new AppException({ code: ErrorCode.INVALID_EXTENSION, message: '지원하지 않는 확장자 입니다' }, 400);
    }
    const key = `auction/${user.memberUuid}/images/${uuidv4()}.${ext}`;

    return await this.auctionFileStoragePort.presignedUrl({
      contentType: command.contentType,
      key,
    });
  };
}
