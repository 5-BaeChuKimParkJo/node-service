import { HttpStatus, Injectable } from '@nestjs/common';
import { CatalogAuction } from '../sync/schema/catalog.schema';
import * as F from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { catalogAuctionSchema } from '../sync/schema/catalog.schema';
import { ErrorCode, AppException } from '@app/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { EnvSchema } from '../common/env-schema';
import { z } from 'zod';
import { RemoteMember, remoteMemberSchema } from './schema/remote-member.schema';

@Injectable()
export class ReadFn {
  constructor(private readonly configService: ConfigService<EnvSchema>) {}

  parseAuction = (auction: any): E.Either<AppException, CatalogAuction> => {
    return E.tryCatch(
      () => catalogAuctionSchema.parse(auction),
      (error) =>
        new AppException(
          { code: ErrorCode.INTERNAL_VALIDATION_ERROR, message: String(error) },
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
    );
  };

  fetchMembers = (memberUuids: string[]): TE.TaskEither<AppException, RemoteMember[]> => {
    return F.pipe(
      TE.tryCatch(
        () =>
          axios.post(`${this.configService.get('MEMBER_SERVICE')}/api/v1/member/list`, {
            memberUuidList: memberUuids,
          }),
        (error) =>
          new AppException(
            { code: ErrorCode.OTHER_SERVICE_ERROR, message: String(error) },
            HttpStatus.INTERNAL_SERVER_ERROR,
          ),
      ),
      TE.flatMap((tags) =>
        TE.fromEither(
          E.tryCatch(
            () => z.array(remoteMemberSchema).parse(tags.data),
            (error) =>
              new AppException(
                { code: ErrorCode.INTERNAL_VALIDATION_ERROR, message: `멤버 스키마 검증 실패: ${String(error)}` },
                HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          ),
        ),
      ),
    );
  };
}
