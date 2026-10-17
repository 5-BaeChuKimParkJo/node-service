const assert = require('node:assert/strict');
const path = require('node:path');
const { PrismaClient, Prisma } = require(path.resolve(
  process.cwd(), 'apps/auction-service/src/prisma/generated',
));

const prisma = new PrismaClient();

async function verify() {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const auction = await tx.auctions.findFirst({ select: { auctionId: true }, orderBy: { auctionId: 'asc' } });
    if (!auction) return { skipped: 'No auctions available; no data was created.' };

    const totalCount = await tx.auctionBidders.count({ where: { auctionId: auction.auctionId, deletedAt: null } });
    const page = async (cursor) => tx.$queryRaw(Prisma.sql`
      SELECT "auctionBidderUuid", "bidderUuid", "bidAmount",
        to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt"
      FROM "AuctionBidders"
      WHERE "auctionId" = ${auction.auctionId} AND "deletedAt" IS NULL
      ${cursor ? Prisma.sql`AND ("createdAt", "auctionBidderUuid") < (${cursor.createdAt}::timestamptz, ${cursor.auctionBidderUuid}::uuid)` : Prisma.empty}
      ORDER BY "AuctionBidders"."createdAt" DESC, "auctionBidderUuid" DESC
      LIMIT 21
    `);
    const rows = await page();
    for (const row of rows) {
      assert.match(row.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
      assert.match(row.bidAmount.toString(), /^\d+$/);
    }
    const cursor = rows.at(-1) ?? {
      createdAt: '2026-01-01T00:00:00.123456Z',
      auctionBidderUuid: '00000000-0000-0000-0000-000000000000',
    };
    const next = await page(cursor);
    assert(!next.some((row) => rows.some((first) => first.auctionBidderUuid === row.auctionBidderUuid)));
    return { readOnly: true, totalCount, firstPage: rows.length, followingPage: next.length, cursorQuery: 'passed' };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

verify().then((result) => console.log(JSON.stringify(result)))
  .catch((error) => { console.error(error.name, error.code ?? '', error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
