import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '@app/common/common/app.exception';
import { HttpAuction, HttpAuctionSchema } from '../common/schema/http-auction.schema';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { EnvSchema } from '../common/env-schema';
import { ErrorCode } from '@app/common';
import * as TE from 'fp-ts/TaskEither';
import * as F from 'fp-ts/function';
import * as E from 'fp-ts/Either';

@Injectable()
export class AuctionEtcFn {
  constructor(private readonly configService: ConfigService<EnvSchema>) {}

  fetchAuctions = (auctionUuids: string[]): TE.TaskEither<AppException, HttpAuction[]> => {
    console.log(auctionUuids, `${this.configService.get('CATALOG_QUERY_SERVICE')}api/v1/auctions/bulk`);

    return F.pipe(
      TE.tryCatch(
        () => axios.post(`${this.configService.get('CATALOG_QUERY_SERVICE')}api/v1/auctions/bulk`, { auctionUuids }),
        (error) =>
          new AppException(
            { code: ErrorCode.OTHER_SERVICE_ERROR, message: String(error) },
            HttpStatus.INTERNAL_SERVER_ERROR,
          ),
      ),
      TE.map((d) => {
        console.log(2.1);
        return d;
      }),
      TE.map((res) => res.data),
      TE.map((d) => {
        console.log(2.2, d);
        return d;
      }),
      TE.flatMap((res) =>
        F.pipe(
          E.tryCatch(
            () => HttpAuctionSchema.array().parse(res),
            (error) =>
              new AppException(
                { code: ErrorCode.VALIDATION_ERROR, message: String(error) },
                HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          ),
          TE.fromEither,
        ),
      ),
    );
  };
}
