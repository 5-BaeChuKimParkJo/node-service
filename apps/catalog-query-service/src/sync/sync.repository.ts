import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Db, DeleteResult, UpdateResult } from 'mongodb';
import * as F from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { CatalogAuction, catalogAuctionSchema } from './schema/catalog.schema';

@Injectable()
export class SyncRepository {
  constructor(@Inject('MONGO_DB') private readonly db: Db) {}

  upsertCatalogAuction = (catalogAuction: CatalogAuction): TE.TaskEither<string, UpdateResult<Document>> => {
    return F.pipe(
      E.tryCatch(
        () => catalogAuctionSchema.parse(catalogAuction),
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

  deleteCatalogAuction = (auctionUuid: string): TE.TaskEither<string, DeleteResult> => {
    return TE.tryCatch(
      () => this.db.collection('catalog').deleteOne({ _id: auctionUuid as any }),
      (error) => `Failed to delete catalog auction: ${String(error)}`,
    );
  };
}
