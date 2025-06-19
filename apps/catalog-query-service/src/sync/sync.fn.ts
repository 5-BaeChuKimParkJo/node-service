import { Injectable } from '@nestjs/common';
import { RemoteTag, remoteTagSchema } from './schema/remote-tag.schema';
import { RemoteCategory, remoteCategorySchema } from './schema/remote-category.schema';
import z from 'zod';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as NEA from 'fp-ts/NonEmptyArray';
import * as Num from 'fp-ts/number';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as Apply from 'fp-ts/Apply';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { EnvSchema } from '../common/env-schema';
import { SyncRepository } from './sync.repository';
import { AuctionChangedValue, U } from '@app/common';

@Injectable()
export class SyncFn {
  constructor(
    private readonly configService: ConfigService<EnvSchema>,
    private readonly syncRepository: SyncRepository,
  ) {}

  fetchCategory = (categoryId: number): TE.TaskEither<string, RemoteCategory> => {
    return F.pipe(
      TE.tryCatch(
        () => axios.get(`${this.configService.get('CATEGORY_SERVICE')}/api/v1/category/${categoryId}`),
        (error) => `카테고리 fetch 실패: ${String(error)}`,
      ),
      TE.flatMap((res) =>
        TE.fromEither(
          E.tryCatch(
            () => remoteCategorySchema.parse(res.data),
            (error) => `카테고리 스키마 검증 실패: ${String(error)}`,
          ),
        ),
      ),
    );
  };

  fetchTags = (tagIds: number[]): TE.TaskEither<string, RemoteTag[]> => {
    return F.pipe(
      TE.tryCatch(
        () =>
          axios.post(`${this.configService.get('TAG_SERVICE')}/api/v1/tag/list`, {
            tagIdList: tagIds,
          }),
        (error) => `태그 fetch 실패: ${String(error)}`,
      ),
      TE.flatMap((tags) =>
        TE.fromEither(
          E.tryCatch(
            () => z.array(remoteTagSchema).parse(tags.data),
            (error) => `태그 스키마 검증 실패: ${String(error)}`,
          ),
        ),
      ),
    );
  };

  deleteAcution = (auctionUuid: string): TE.TaskEither<string, void> => {
    return F.pipe(
      auctionUuid,
      this.syncRepository.deleteCatalogAuction,
      TE.map(() => undefined),
    );
  };

  upsertAuction = (auctionChangedValues: AuctionChangedValue[]): TE.TaskEither<string, void> => {
    return F.pipe(
      auctionChangedValues,
      A.map((o) => o.payload),
      NEA.fromArray,
      O.map(NEA.max(U.Rec.ordBy('version', Num.Ord))),
      TE.fromOption(() => 'no auction'),
      TE.flatMap((auction) =>
        F.pipe(
          {
            category: auction.categoryId ? this.fetchCategory(auction.categoryId) : TE.right(null),
            tags: this.fetchTags(auction.tagIds),
          },
          Apply.sequenceS(TE.ApplicativePar),
          TE.let('auction', () => auction),
        ),
      ),
      TE.map(({ auction, category, tags }) => ({
        ...auction,
        type: 'auction' as const,
        category,
        tags,
      })),
      TE.flatMap(this.syncRepository.upsertCatalogAuction),
      TE.map(() => undefined),
    );
  };
}
