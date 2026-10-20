import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AdminHistoryCommand } from '../../../application/model/admin-history.command';
import { AdminHistoryQueryPort, AdminHistoryRecord } from '../../../application/port/out/admin-history-query.port';

@Injectable()
export class AdminHistoryPrismaAdapter extends AdminHistoryQueryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  find({ action, auctionUuid, from, to, cursor }: AdminHistoryCommand): Promise<AdminHistoryRecord[]> {
    return this.prisma.$queryRaw<AdminHistoryRecord[]>(Prisma.sql`
      WITH history AS (
        SELECT ('auction:' || h."auctionAdminActionId"::text) AS "entryKey", h."createdAt" AS "occurredAt",
          h."auctionUuid", a."title" AS "auctionTitle", h."actor", h."action", h."reason",
          'SUCCEEDED'::text AS "status", h."previousStatus", h."nextStatus", NULL::bigint AS "amount"
        FROM "AuctionAdminActions" h
        LEFT JOIN "Auctions" a ON a."auctionUuid" = h."auctionUuid"
        UNION ALL
        SELECT ('payment:' || attempt."orderId") AS "entryKey", attempt."cancelRequestedAt" AS "occurredAt",
          p."auctionUuid", a."title" AS "auctionTitle", attempt."cancelActor" AS "actor",
          'payment-cancel'::text AS "action", attempt."cancelReason" AS "reason",
          CASE WHEN attempt."status" = 'CANCELED' THEN 'SUCCEEDED'
            WHEN attempt."status" = 'CANCELING' THEN 'PENDING' ELSE 'REVIEW_REQUIRED' END AS "status",
          NULL::text AS "previousStatus", NULL::text AS "nextStatus", p."amount"
        FROM "AuctionPaymentAttempt" attempt
        JOIN "AuctionPurchase" p ON p."purchaseUuid" = attempt."purchaseUuid"
        LEFT JOIN "Auctions" a ON a."auctionUuid" = p."auctionUuid"
        WHERE attempt."cancelRequestedAt" IS NOT NULL
      )
      SELECT "entryKey", to_char("occurredAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "occurredAt",
        "auctionUuid", "auctionTitle", "actor", "action", "reason", "status", "previousStatus", "nextStatus", "amount"
      FROM history WHERE true
      ${action ? Prisma.sql`AND "action" = ${action}` : Prisma.empty}
      ${auctionUuid ? Prisma.sql`AND "auctionUuid" = ${auctionUuid}::uuid` : Prisma.empty}
      ${from ? Prisma.sql`AND "occurredAt" >= ${from}::timestamptz` : Prisma.empty}
      ${to ? Prisma.sql`AND "occurredAt" < ${to}::timestamptz` : Prisma.empty}
      ${cursor ? Prisma.sql`AND ("occurredAt", "entryKey" COLLATE "C") < (${cursor.occurredAt}::timestamptz, ${cursor.entryKey}::text COLLATE "C")` : Prisma.empty}
      ORDER BY history."occurredAt" DESC, "entryKey" COLLATE "C" DESC LIMIT 21
    `);
  }
}
