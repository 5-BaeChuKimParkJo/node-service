import {
  CheckFileExistsArgs,
  GetObjectReturn,
  PresignedUrlArgs,
  PresignedUrlResult,
  PutObjectArgs,
} from './auction-file-storage-port.types';

export abstract class AuctionFileStoragePort {
  abstract presignedUrl: (args: PresignedUrlArgs) => Promise<PresignedUrlResult>;

  abstract checkFileExists: (args: CheckFileExistsArgs) => Promise<void>;

  abstract putObject: (args: PutObjectArgs) => Promise<void>;

  abstract getObject: (key: string) => Promise<GetObjectReturn>;

  abstract toFullUrl: (key: string) => string;
}
