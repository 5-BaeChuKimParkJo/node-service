import { Injectable } from '@nestjs/common';
import { S3Service } from '@app/common/s3/s3.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Prisma } from '../../../../prisma/generated';
import { PopularAuctionRepositoryPort } from '../../../application/port/out/popular-auction-repository.port';
import { PopularAuctionListing, PopularAuctionScore } from '../../../application/model/popular-auctions.result';

@Injectable()
export class PopularAuctionPrismaAdapter extends PopularAuctionRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: S3Service,
  ) {
    super();
  }

  rank(now: Date): Promise<PopularAuctionScore[]> {
    const from = new Date(now.getTime() - 86400000);
    // Aggregate each signal separately so joining views and bids cannot multiply counts.
    return this.prisma.$queryRaw<PopularAuctionScore[]>(Prisma.sql`
      WITH eligible AS (
        SELECT "auctionId", "auctionUuid", "sellerUuid", "endAt"
        FROM "Auctions"
        WHERE "status" = 'visible' AND "deletedAt" IS NULL AND "soldAt" IS NULL
          AND "startAt" <= ${now} AND "endAt" > ${now}
      ), views AS (
        SELECT v."auctionUuid", COUNT(DISTINCT v."viewerUuid") AS count
        FROM "AuctionViewed" v JOIN eligible a ON a."auctionUuid" = v."auctionUuid"
        WHERE v."viewedAt" >= ${from} AND v."viewedAt" < ${now}
          AND v."viewerUuid" <> a."sellerUuid"
        GROUP BY v."auctionUuid"
      ), bids AS (
        SELECT b."auctionId", COUNT(DISTINCT b."bidderUuid") AS count
        FROM "AuctionBidders" b JOIN eligible a ON a."auctionId" = b."auctionId"
        WHERE b."createdAt" >= ${from} AND b."createdAt" < ${now}
          AND b."deletedAt" IS NULL AND b."bidAmount" > 0 AND b."bidderUuid" <> a."sellerUuid"
        GROUP BY b."auctionId"
      ), scores AS (
        SELECT a."auctionUuid", a."endAt", COALESCE(v.count, 0) AS viewers,
          COALESCE(b.count, 0) AS bidders,
          COALESCE(v.count, 0) + 5 * COALESCE(b.count, 0) AS score
        FROM eligible a LEFT JOIN views v ON v."auctionUuid" = a."auctionUuid"
          LEFT JOIN bids b ON b."auctionId" = a."auctionId"
      )
      SELECT "auctionUuid", viewers::text AS "uniqueViewers", bidders::text AS "uniqueBidders", score::text AS score
      FROM scores WHERE score > 0
      ORDER BY scores.score DESC, scores.bidders DESC, scores.viewers DESC, scores."endAt" ASC, scores."auctionUuid" ASC
      LIMIT 10
    `);
  }

  async findActive(auctionUuids: string[], now: Date): Promise<PopularAuctionListing[]> {
    if (!auctionUuids.length) return [];
    const rows = await this.prisma.auctions.findMany({
      where: {
        auctionUuid: { in: auctionUuids },
        status: 'visible',
        deletedAt: null,
        soldAt: null,
        startAt: { lte: now },
        endAt: { gt: now },
      },
      select: {
        auctionUuid: true,
        title: true,
        thumbnailKey: true,
        minimumBid: true,
        currentBid: true,
        startAt: true,
        endAt: true,
      },
    });
    return rows.map(({ thumbnailKey, ...listing }) => ({
      ...listing,
      thumbnailUrl: this.media.toFullUrl(thumbnailKey),
    }));
  }

  async recordView({ auctionUuid, viewerUuid }: { auctionUuid: string; viewerUuid: string }, now: Date): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO "AuctionViewed" ("auctionUuid", "viewerUuid", "viewedAt", "createdAt")
      SELECT a."auctionUuid", ${viewerUuid}::uuid, ${now}, ${now} FROM "Auctions" a
      WHERE a."auctionUuid" = ${auctionUuid}::uuid AND a."sellerUuid" <> ${viewerUuid}::uuid
        AND a."status" = 'visible' AND a."deletedAt" IS NULL AND a."soldAt" IS NULL
        AND a."startAt" <= ${now} AND a."endAt" > ${now}
    `;
  }
}
