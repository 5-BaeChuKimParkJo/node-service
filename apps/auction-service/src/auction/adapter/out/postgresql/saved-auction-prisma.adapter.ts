import { Injectable } from '@nestjs/common';
import { S3Service } from '@app/common/s3/s3.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Prisma } from '../../../../prisma/generated';
import { SavedAuctionRepositoryPort } from '../../../application/port/out/saved-auction-repository.port';
import type { SavedAuctionPage, SavedAuctionRecord } from '../../../application/model/saved-auction.result';

type StoredSavedAuction = Omit<SavedAuctionRecord, 'thumbnailUrl'> & { savedId: string; thumbnailKey: string };

@Injectable()
export class SavedAuctionPrismaAdapter extends SavedAuctionRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: S3Service,
  ) {
    super();
  }

  async list(memberUuid: string, cursor: string | null): Promise<SavedAuctionPage> {
    const rows = await this.prisma.$queryRaw<StoredSavedAuction[]>(Prisma.sql`
      SELECT s."savedId"::text AS "savedId",s."createdAt" AS "savedAt",a."auctionUuid",a."title",a."thumbnailKey",
        a."minimumBid"::text AS "minimumBid",a."currentBid"::text AS "currentBid",a."startAt",a."endAt"
      FROM "SavedAuction" s JOIN "Auctions" a ON a."auctionUuid"=s."auctionUuid"
      WHERE s."memberUuid"=${memberUuid}::uuid AND a."status"='visible' AND a."deletedAt" IS NULL
        ${cursor === null ? Prisma.empty : Prisma.sql`AND s."savedId" < ${BigInt(cursor)}`}
      ORDER BY s."savedId" DESC LIMIT 21
    `);
    const page = rows.slice(0, 20);
    return {
      items: page.map((row) => ({
        auctionUuid: row.auctionUuid,
        title: row.title,
        thumbnailUrl: this.media.toFullUrl(row.thumbnailKey),
        minimumBid: row.minimumBid,
        currentBid: row.currentBid,
        startAt: row.startAt,
        endAt: row.endAt,
        savedAt: row.savedAt,
      })),
      nextCursor: rows.length > 20 ? page[19].savedId : null,
    };
  }

  async state(memberUuid: string, auctionUuid: string): Promise<boolean | null> {
    const rows = await this.prisma.$queryRaw<Array<{ saved: boolean }>>`
      SELECT EXISTS(SELECT 1 FROM "SavedAuction" s WHERE s."auctionUuid"=a."auctionUuid" AND s."memberUuid"=${memberUuid}::uuid) AS saved
      FROM "Auctions" a WHERE a."auctionUuid"=${auctionUuid}::uuid AND a."status"='visible' AND a."deletedAt" IS NULL
    `;
    return rows[0]?.saved ?? null;
  }

  async save(memberUuid: string, auctionUuid: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ savedId: bigint }>>`
      INSERT INTO "SavedAuction" ("memberUuid","auctionUuid")
      SELECT ${memberUuid}::uuid,a."auctionUuid" FROM "Auctions" a
      WHERE a."auctionUuid"=${auctionUuid}::uuid AND a."status"='visible' AND a."deletedAt" IS NULL
      ON CONFLICT ("memberUuid","auctionUuid") DO UPDATE SET "memberUuid"=EXCLUDED."memberUuid"
      RETURNING "savedId"
    `;
    return rows.length === 1;
  }

  async remove(memberUuid: string, auctionUuid: string): Promise<void> {
    await this.prisma
      .$executeRaw`DELETE FROM "SavedAuction" WHERE "memberUuid"=${memberUuid}::uuid AND "auctionUuid"=${auctionUuid}::uuid`;
  }
}
