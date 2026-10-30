import { Injectable } from '@nestjs/common';
import { S3Service } from '@app/common/s3/s3.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Prisma } from '../../../../prisma/generated';
import { MySalesQueryPort } from '../../../application/port/out/my-sales-query.port';
import type {
  MySaleRecord,
  MySalesPageRecord,
  MySalesQuery,
  MySalesSummary,
} from '../../../application/model/my-sales.result';

@Injectable()
export class MySalesPrismaAdapter extends MySalesQueryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: S3Service,
  ) {
    super();
  }

  async list(memberUuid: string, query: MySalesQuery, now: Date): Promise<MySalesPageRecord> {
    const own = Prisma.sql`WITH own AS (
      SELECT a.*, CASE WHEN a."status"='hidden' THEN 'hidden' WHEN a."status"='cancelled' THEN 'cancelled'
        WHEN a."endAt" <= ${now} THEN 'ended' WHEN a."startAt" > ${now} THEN 'waiting' ELSE 'active' END AS "displayStatus"
      FROM "Auctions" a WHERE a."sellerUuid"=${memberUuid}::uuid AND a."deletedAt" IS NULL
    )`;
    const filter = Prisma.sql`(${query.q} = '' OR POSITION(LOWER(${query.q}) IN LOWER(a."title")) > 0)
      ${query.status === 'all' ? Prisma.empty : Prisma.sql`AND a."displayStatus"=${query.status}`}`;
    const order = {
      recent: Prisma.sql`a."createdAt" DESC,a."auctionId" DESC`,
      ending: Prisma.sql`a."endAt" ASC,a."auctionId" DESC`,
      price: Prisma.sql`GREATEST(a."currentBid",a."minimumBid") DESC,a."auctionId" DESC`,
    }[query.sort];
    const [counts, rows] = await this.prisma.$transaction(
      [
        this.prisma.$queryRaw<Array<MySalesSummary & { filteredTotal: number }>>(Prisma.sql`${own}
        SELECT COUNT(*)::int AS total,
          (COUNT(*) FILTER (WHERE a."displayStatus"='waiting'))::int AS waiting,
          (COUNT(*) FILTER (WHERE a."displayStatus"='active'))::int AS active,
          (COUNT(*) FILTER (WHERE a."displayStatus"='ended'))::int AS ended,
          (COUNT(*) FILTER (WHERE a."displayStatus"='hidden'))::int AS hidden,
          (COUNT(*) FILTER (WHERE a."displayStatus"='cancelled'))::int AS cancelled,
          (COUNT(*) FILTER (WHERE ${filter}))::int AS "filteredTotal"
        FROM own a`),
        this.prisma.$queryRaw<Array<Omit<MySaleRecord, 'thumbnailUrl'> & { thumbnailKey: string }>>(Prisma.sql`${own}
        SELECT a."auctionUuid",a."title",a."thumbnailKey",a."minimumBid"::text AS "minimumBid",
          a."currentBid"::text AS "currentBid",a."startAt",a."endAt",a."createdAt",a."displayStatus" AS status,
          (SELECT COUNT(*)::int FROM "AuctionBidders" b WHERE b."auctionId"=a."auctionId" AND b."deletedAt" IS NULL) AS "bidCount"
        FROM own a WHERE ${filter} ORDER BY ${order} LIMIT 20 OFFSET ${(query.page - 1) * 20}`),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const { filteredTotal, ...summary } = counts[0];
    return {
      summary,
      total: filteredTotal,
      items: rows.map(({ thumbnailKey, ...item }) => ({ ...item, thumbnailUrl: this.media.toFullUrl(thumbnailKey) })),
    };
  }
}
