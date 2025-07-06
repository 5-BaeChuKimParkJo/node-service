import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Db, DeleteResult, UpdateResult } from 'mongodb';
import * as F from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {
  MongoCatalogTypeAuction,
  mongoCatalogTypeAuctionSchema,
  MongoCatalogTypeProduct,
  mongoCatalogTypeProductSchema,
} from '../common/schema/mongo-catalog.schema';

@Injectable()
export class SyncRepository {
  constructor(@Inject('MONGO_DB') private readonly db: Db) {}

  upsertCatalogAuction = (catalogAuction: MongoCatalogTypeAuction): TE.TaskEither<string, UpdateResult<Document>> => {
    return F.pipe(
      E.tryCatch(
        () => mongoCatalogTypeAuctionSchema.parse(catalogAuction),
        (error) => `Failed to parse catalog auction: ${String(error)}`,
      ),
      TE.fromEither,
      TE.flatMap((parsed) =>
        TE.tryCatch(
          () =>
            this.db.collection('catalog').updateOne(
              { _id: parsed.auctionUuid as any },
              {
                $set: parsed,
              },
              { upsert: true },
            ),
          (error) => `Failed to upsert catalog auction: ${String(error)}`,
        ),
      ),
    );
  };

  upsertCatalogProduct = (catalogProduct: MongoCatalogTypeProduct): TE.TaskEither<string, UpdateResult<Document>> => {
    return F.pipe(
      E.tryCatch(
        () => mongoCatalogTypeProductSchema.parse(catalogProduct),
        (error) => `Failed to parse catalog product: ${String(error)}`,
      ),
      TE.fromEither,
      TE.flatMap((parsed) =>
        TE.tryCatch(
          () => this.db.collection('catalog').updateOne({ _id: parsed.id as any }, { $set: parsed }, { upsert: true }),
          (error) => `Failed to upsert catalog product: ${String(error)}`,
        ),
      ),
    );
  };

  deleteCatalogAuction = (auctionUuid: string): TE.TaskEither<string, DeleteResult> => {
    return TE.tryCatch(
      () => this.db.collection('catalog').deleteOne({ _id: auctionUuid as any }),
      (error) => `Failed to delete catalog auction: ${String(error)}`,
    );
  };

  deleteCatalogProduct = (productUuid: number): TE.TaskEither<string, DeleteResult> => {
    return TE.tryCatch(
      () => this.db.collection('catalog').deleteOne({ _id: productUuid as any }),
      (error) => `Failed to delete catalog product: ${String(error)}`,
    );
  };
}
