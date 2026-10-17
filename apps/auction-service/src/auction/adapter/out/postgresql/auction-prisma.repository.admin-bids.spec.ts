import { AuctionPrismaRepository } from './auction-prisma.repository';

const auctionUuid = '10000000-0000-0000-0000-000000000000';
const createdAt = '2026-10-13T02:34:56.123456Z';
const bid = (index: number) => ({
  auctionBidderUuid: `20000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
  bidderUuid: '30000000-0000-0000-0000-000000000000',
  bidAmount: 9007199254740993n,
  createdAt,
});

function setup(rows = [bid(1)], totalCount = rows.length) {
  const tx = {
    auctions: { findUnique: vi.fn().mockResolvedValue({ auctionId: 42n }) },
    auctionBidders: { count: vi.fn().mockResolvedValue(totalCount) },
    $queryRaw: vi.fn().mockResolvedValue(rows),
  };
  const prisma = { $transaction: vi.fn().mockImplementation(async (callback) => callback(tx)) };
  return {
    tx,
    prisma,
    repository: new AuctionPrismaRepository(prisma as never, {} as never, {} as never),
  };
}

describe('AuctionPrismaRepository admin bid history', () => {
  it('scopes count and history to undeleted bids in the same repeatable read snapshot', async () => {
    const { repository, tx, prisma } = setup();

    await expect(repository.findAdminBids({ auctionUuid })).resolves.toEqual({
      items: [bid(1)],
      totalCount: 1,
      nextCursor: null,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
    expect(tx.auctions.findUnique).toHaveBeenCalledWith({
      where: { auctionUuid },
      select: { auctionId: true },
    });
    expect(tx.auctionBidders.count).toHaveBeenCalledWith({ where: { auctionId: 42n, deletedAt: null } });
    const query = tx.$queryRaw.mock.calls[0][0];
    expect(query.text).toMatch(/FROM "AuctionBidders"/);
    expect(query.text).toMatch(/"auctionId" = \$\d+/);
    expect(query.text).toContain('"deletedAt" IS NULL');
    expect(query.text).toContain('ORDER BY "AuctionBidders"."createdAt" DESC, "auctionBidderUuid" DESC');
    expect(query.text).toMatch(/LIMIT (21|\$\d+)/);
    expect(query.values).toContain(42n);
    expect(query.text).toContain('US');
  });

  it('returns only 20 rows and uses the last returned row as the next cursor', async () => {
    const rows = Array.from({ length: 21 }, (_, index) => bid(30 - index));
    const { repository } = setup(rows, 35);

    const result = await repository.findAdminBids({ auctionUuid });

    expect(result.items).toEqual(rows.slice(0, 20));
    expect(result.totalCount).toBe(35);
    expect(result.nextCursor).toEqual({
      createdAt: '2026-10-13T02:34:56.123456Z',
      auctionBidderUuid: '20000000-0000-0000-0000-000000000011',
    });
  });

  it('uses a strict lexicographic cursor with full timestamp precision and an unfiltered total', async () => {
    const { repository, tx } = setup([bid(10)], 35);
    const cursor = { createdAt, auctionBidderUuid: '20000000-0000-0000-0000-000000000011' };

    const result = await repository.findAdminBids({ auctionUuid, cursor });

    const query = tx.$queryRaw.mock.calls[0][0];
    expect(query.text).toMatch(/\("createdAt", "auctionBidderUuid"\) < \(\$\d+::timestamptz, \$\d+::uuid\)/);
    expect(query.values).toContain(createdAt);
    expect(query.values).toContain(cursor.auctionBidderUuid);
    expect(tx.auctionBidders.count).toHaveBeenCalledWith({ where: { auctionId: 42n, deletedAt: null } });
    expect(result).toEqual({ items: [bid(10)], totalCount: 35, nextCursor: null });
  });

  it.each([0, 20])('has no next cursor when the final page contains %i bids', async (length) => {
    const rows = Array.from({ length }, (_, index) => bid(30 - index));
    const { repository } = setup(rows);
    await expect(repository.findAdminBids({ auctionUuid })).resolves.toEqual({
      items: rows,
      totalCount: length,
      nextCursor: null,
    });
  });

  it('returns the existing not-found exception before reading bids for a missing auction', async () => {
    const { repository, tx } = setup();
    tx.auctions.findUnique.mockResolvedValue(null);

    await expect(repository.findAdminBids({ auctionUuid })).rejects.toMatchObject({ status: 404 });
    expect(tx.auctionBidders.count).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
