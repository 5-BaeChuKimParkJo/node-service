import { User } from '@app/common/types/user';

export type UploadAuctionImageCommand = {
  contentType: string;
  bytes: Buffer;
};

export type UploadAuctionImageResult = {
  key: string;
  url: string;
};

export abstract class UploadAuctionImageUseCase {
  abstract execute(command: UploadAuctionImageCommand, user: User): Promise<UploadAuctionImageResult>;
}
