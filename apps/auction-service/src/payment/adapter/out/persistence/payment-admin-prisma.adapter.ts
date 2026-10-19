import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PaymentAdminListCommand, PaymentReviewPolicy } from '../../../application/model/payment-admin-list.command';
import { PaymentAdminQueryPort, PaymentAdminRecord } from '../../../application/port/out/payment-admin-query.port';

@Injectable()
export class PaymentAdminPrismaAdapter extends PaymentAdminQueryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  find(
    { query, status, attention, from, to, cursor, includeUnstarted = false }: PaymentAdminListCommand,
    policy: PaymentReviewPolicy & { asOf: string } = { dueHours: 24, soonHours: 6, asOf: new Date().toISOString() },
  ): Promise<PaymentAdminRecord[]> {
    // Keep PostgreSQL microseconds as text throughout the read and cursor round trip.
    return this.prisma.$queryRaw<PaymentAdminRecord[]>(Prisma.sql`
      SELECT p."purchaseUuid", p."auctionUuid", p."buyerUuid", p."orderName", p."amount", p."status",
        to_char(p."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
        to_char(p."paidAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "paidAt",
        to_char(deadline."dueAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "reviewDueAt",
        review."attention",
        latest."orderId" AS "attemptOrderId", latest."status" AS "attemptStatus", latest."method" AS "attemptMethod",
        latest."cancelReason" AS "attemptCancelReason"
      FROM "Auctions" auction
      LEFT JOIN "AuctionPurchase" purchase ON purchase."auctionUuid" = auction."auctionUuid"
      CROSS JOIN LATERAL (
        SELECT purchase."purchaseUuid", auction."auctionUuid",
          COALESCE(purchase."buyerUuid"::text, auction."currentBidderUuid") AS "buyerUuid",
          COALESCE(purchase."orderName", auction."title") AS "orderName",
          COALESCE(purchase."amount", auction."currentBid") AS "amount",
          COALESCE(purchase."status"::text, 'NOT_STARTED') AS "status",
          COALESCE(purchase."createdAt", auction."endAt") AS "createdAt", purchase."paidAt"
      ) p
      LEFT JOIN LATERAL (
        SELECT a."orderId", a."status", a."method", a."errorCode", a."cancelReason"
        FROM "AuctionPaymentAttempt" a WHERE a."purchaseUuid" = p."purchaseUuid"
        ORDER BY a."attemptNumber" DESC LIMIT 1
      ) latest ON true
      CROSS JOIN LATERAL (
        SELECT auction."endAt" + (${policy.dueHours}::integer * interval '1 hour') AS "dueAt"
      ) deadline
      CROSS JOIN LATERAL (
        SELECT CASE
          WHEN p."status" = 'CANCELED' THEN 'NONE'
          WHEN latest."errorCode" IS NOT NULL OR latest."status" IN ('CONFIRMING', 'UNKNOWN', 'CANCELING', 'WAITING_FOR_DEPOSIT') THEN 'REVIEW_REQUIRED'
          WHEN p."status" NOT IN ('AWAITING_PAYMENT', 'NOT_STARTED') THEN 'NONE'
          WHEN deadline."dueAt" <= ${policy.asOf}::timestamptz THEN 'OVERDUE'
          WHEN deadline."dueAt" <= ${policy.asOf}::timestamptz + (${policy.soonHours}::integer * interval '1 hour') THEN 'DUE_SOON'
          ELSE 'WAITING'
        END AS "attention"
      ) review
      WHERE (p."purchaseUuid" IS NOT NULL OR (${includeUnstarted} AND
        auction."status" = 'visible' AND auction."deletedAt" IS NULL AND auction."soldAt" IS NULL
        AND auction."endAt" <= ${policy.asOf}::timestamptz
        AND NULLIF(trim(auction."currentBidderUuid"), '') IS NOT NULL
        AND auction."currentBidderUuid" <> auction."sellerUuid"::text
        AND auction."currentBid" > 0 AND auction."currentBid" <= 9007199254740991
      ))
      ${
        query
          ? Prisma.sql`AND (strpos(lower(p."orderName"), lower(${query})) > 0 OR EXISTS (
        SELECT 1 FROM "AuctionPaymentAttempt" search
        WHERE search."purchaseUuid" = p."purchaseUuid" AND strpos(lower(search."orderId"), lower(${query})) > 0
      ))`
          : Prisma.empty
      }
      ${status ? Prisma.sql`AND p."status" = ${status}` : Prisma.empty}
      ${attention ? Prisma.sql`AND review."attention" = ${attention}` : Prisma.empty}
      ${from ? Prisma.sql`AND p."createdAt" >= ${from}::timestamptz` : Prisma.empty}
      ${to ? Prisma.sql`AND p."createdAt" < ${to}::timestamptz` : Prisma.empty}
      ${cursor ? Prisma.sql`AND (p."createdAt", p."auctionUuid") < (${cursor.createdAt}::timestamptz, ${cursor.auctionUuid ? Prisma.sql`${cursor.auctionUuid}::uuid` : Prisma.sql`(SELECT "auctionUuid" FROM "AuctionPurchase" WHERE "purchaseUuid" = ${cursor.purchaseUuid}::uuid)`})` : Prisma.empty}
      ORDER BY p."createdAt" DESC, p."auctionUuid" DESC
      LIMIT 21
    `);
  }
}
