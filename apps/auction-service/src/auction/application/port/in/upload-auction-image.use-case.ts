import { User } from '@app/common';

export type UploadAuctionImageCommand = {
  contentType: string;
  bytes: Buffer;
};

export type UploadAuctionImageResponse = {
  key: string;
  url: string;
};

export abstract class UploadAuctionImageUseCase {
  abstract execute(
    command: UploadAuctionImageCommand,
    user: User,
  ): Promise<UploadAuctionImageResponse>;
}
