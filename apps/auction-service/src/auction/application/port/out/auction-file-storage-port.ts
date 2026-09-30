import {
  CheckFileExistsArgs,
  GetObjectReturn,
  PresignedUrlArgs,
  PrisignedUrlReturn,
  PutObjectArgs,
} from './auction-file-storage-port.types';

export abstract class AuctionFileStoragePort {
  abstract presignedUrl: (args: PresignedUrlArgs) => Promise<PrisignedUrlReturn>;

  abstract checkFileExists: (args: CheckFileExistsArgs) => Promise<void>;

  abstract putObject: (args: PutObjectArgs) => Promise<void>;

  abstract getObject: (key: string) => Promise<GetObjectReturn>;

  abstract toFullUrl: (key: string) => string;
}
