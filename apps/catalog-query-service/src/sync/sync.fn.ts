import { Injectable } from '@nestjs/common';
import { HttpTag, httpTagSchema } from '../common/schema/http-tag.schema';
import { HttpCategory, httpCategorySchema } from '../common/schema/http-category.schema';
import z from 'zod';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as NEA from 'fp-ts/NonEmptyArray';
import * as Num from 'fp-ts/number';
import * as Dat from 'fp-ts/Date';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as Apply from 'fp-ts/Apply';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { EnvSchema } from '../common/env-schema';
import { SyncRepository } from './sync.repository';
import { KafkaAuctionServiceOutboxTopicValue, U, KafkaProductServiceOutboxTopicValue } from '@app/common';
import { MongoCatalogTypeProduct } from '../common/schema/mongo-catalog.schema';

@Injectable()
export class SyncFn {
  constructor(
    private readonly configService: ConfigService<EnvSchema>,
    private readonly syncRepository: SyncRepository,
  ) {}

  fetchCategory = (categoryId: number): TE.TaskEither<string, HttpCategory> => {
    return F.pipe(
      TE.tryCatch(
        () => axios.get(`${this.configService.get('CATEGORY_SERVICE')}/api/v1/category/${categoryId}`),
        (error) => `카테고리 fetch 실패: ${String(error)}`,
      ),
      TE.flatMap((res) =>
        TE.fromEither(
          E.tryCatch(
            () => httpCategorySchema.parse(res.data),
            (error) => `카테고리 스키마 검증 실패: ${String(error)}`,
          ),
        ),
      ),
    );
  };

  fetchTags = (tagIds: number[]): TE.TaskEither<string, HttpTag[]> => {
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
            () => z.array(httpTagSchema).parse(tags.data),
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

  upsertAuction = (
    kafkaAuctionServiceOutboxTopicValue: KafkaAuctionServiceOutboxTopicValue[],
  ): TE.TaskEither<string, void> => {
    return F.pipe(
      kafkaAuctionServiceOutboxTopicValue,
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

  upsertProduct = (
    kafkaProductServiceOutboxValues: KafkaProductServiceOutboxTopicValue[],
  ): TE.TaskEither<string, void> => {
    return F.pipe(
      kafkaProductServiceOutboxValues,
      A.map((o) => o.payload),
      NEA.fromArray,
      O.map(NEA.max(U.Rec.ordBy('createdAt', Dat.Ord))),
      TE.fromOption(() => 'no product'),
      TE.flatMap((product) =>
        F.pipe(
          {
            category: this.fetchCategory(Number(product.categoryId)),
            tags: this.fetchTags(product.tagIdList),
          },
          Apply.sequenceS(TE.ApplicativePar),
          TE.let('product', () => product),
        ),
      ),
      TE.map(
        ({ product, category, tags }) =>
          ({
            ...product,
            type: 'product' as const,
            category,
            tags,
          }) satisfies MongoCatalogTypeProduct,
      ),
      TE.flatMap(this.syncRepository.upsertCatalogProduct),
      TE.map(() => undefined),
    );
  };

  deleteProduct = (productUuid: number): TE.TaskEither<string, void> => {
    return F.pipe(
      productUuid,
      this.syncRepository.deleteCatalogProduct,
      TE.map(() => undefined),
    );
  };
}
