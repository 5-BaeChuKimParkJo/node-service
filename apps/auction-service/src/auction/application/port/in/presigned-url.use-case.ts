import { User } from '@app/common/types/user';
import { PresignedUrlCommand } from '../../model/presigned-url.command';
import { PresignedUrlResult } from '../../model/presigned-url.result';

export abstract class PresignedUrlUseCase {
  abstract execute: (command: PresignedUrlCommand, user: User) => Promise<PresignedUrlResult>;
}
