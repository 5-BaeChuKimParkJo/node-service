import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PaymentAdminListCommand } from '../../../application/model/payment-admin-list.command';
import { PaymentAdminQueryPort, PaymentAdminRecord } from '../../../application/port/out/payment-admin-query.port';

@Injectable()
export class PaymentAdminPrismaAdapter extends PaymentAdminQueryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  find({ query, status, from, to, cursor }: PaymentAdminListCommand): Promise<PaymentAdminRecord[]> {
    // Keep PostgreSQL microseconds as text throughout the read and cursor round trip.
    return this.prisma.$queryRaw<PaymentAdminRecord[]>(Prisma.sql`
      SELECT p."purchaseUuid", p."auctionUuid", p."buyerUuid", p."orderName", p."amount", p."status",
        to_char(p."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
        to_char(p."paidAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "paidAt",
        latest."orderId" AS "attemptOrderId", latest."status" AS "attemptStatus", latest."method" AS "attemptMethod"
      FROM "AuctionPurchase" p
      LEFT JOIN LATERAL (
        SELECT a."orderId", a."status", a."method"
        FROM "AuctionPaymentAttempt" a WHERE a."purchaseUuid" = p."purchaseUuid"
        ORDER BY a."attemptNumber" DESC LIMIT 1
      ) latest ON true
      WHERE true
      ${
        query
          ? Prisma.sql`AND (strpos(lower(p."orderName"), lower(${query})) > 0 OR EXISTS (
        SELECT 1 FROM "AuctionPaymentAttempt" search
        WHERE search."purchaseUuid" = p."purchaseUuid" AND strpos(lower(search."orderId"), lower(${query})) > 0
      ))`
          : Prisma.empty
      }
      ${status ? Prisma.sql`AND p."status" = ${status}::"AuctionPurchaseStatus"` : Prisma.empty}
      ${from ? Prisma.sql`AND p."createdAt" >= ${from}::timestamptz` : Prisma.empty}
      ${to ? Prisma.sql`AND p."createdAt" < ${to}::timestamptz` : Prisma.empty}
      ${cursor ? Prisma.sql`AND (p."createdAt", p."purchaseUuid") < (${cursor.createdAt}::timestamptz, ${cursor.purchaseUuid}::uuid)` : Prisma.empty}
      ORDER BY p."createdAt" DESC, p."purchaseUuid" DESC
      LIMIT 21
    `);
  }
}
