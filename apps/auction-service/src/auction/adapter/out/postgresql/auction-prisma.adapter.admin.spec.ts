import { AuctionPrismaAdapter } from './auction-prisma.adapter';

const row = {
  auctionId: 1n,
  auctionUuid: '10000000-0000-0000-0000-000000000000',
  categoryId: 1,
  title: '관리자 경매 테스트',
  description: '관리자 상태 변경 트랜잭션 테스트입니다.',
  minimumBid: 1000n,
  currentBid: 1500n,
  currentBidderUuid: '20000000-0000-0000-0000-000000000000',
  startAt: new Date('2026-10-13T02:00:00.000Z'),
  endAt: new Date('2026-10-13T05:00:00.000Z'),
  soldAt: null,
  isDirectDeal: false,
  directDealLocation: null,
  status: 'visible' as const,
  productCondition: 'used' as const,
  viewCount: 10n,
  thumbnailKey: 'auction/thumbnail.jpg',
  createdAt: new Date('2026-10-12T01:00:00.000Z'),
  updatedAt: new Date('2026-10-12T01:00:00.000Z'),
  deletedAt: null,
  sellerUuid: '30000000-0000-0000-0000-000000000000',
  version: 0,
  tagIds: [],
  auctionImages: [],
};

describe('AuctionPrismaRepository admin actions', () => {
  it('filters ending-soon auctions in the database before pagination', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T00:00:00Z'));
    try {
      const prisma = { auctions: { findMany: vi.fn().mockResolvedValue([]) } };
      const repository = new AuctionPrismaAdapter(prisma as never, {} as never, {} as never);
      await repository.findAuctions({ type: 'admin', endingSoon: true });
      expect(prisma.auctions.findMany.mock.calls[0][0]).toMatchObject({
        take: 21,
        where: {
          AND: expect.arrayContaining([
            {
              status: 'visible',
              deletedAt: null,
              soldAt: null,
              startAt: { lte: new Date('2026-10-20T00:00:00Z') },
              endAt: { gt: new Date('2026-10-20T00:00:00Z'), lte: new Date('2026-10-21T00:00:00Z') },
            },
          ]),
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });
  it('updates the auction, audit row, and outbox in one transaction', async () => {
    const tx = {
      auctions: {
        findUnique: vi.fn().mockResolvedValue(row),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...row,
            status: data.status,
            endAt: data.endAt,
            version: 1,
          }),
        ),
      },
      auctionAdminActions: { create: vi.fn().mockResolvedValue(undefined) },
      outbox: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      $transaction: vi.fn().mockImplementation(async (callback) => callback(tx)),
    };
    const storage = { toFullUrl: (key: string) => `http://minio/${key}` };
    const taxonomy = { resolveNames: vi.fn().mockResolvedValue({ categoryName: 'Camera', tagNames: [] }) };
    const repository = new AuctionPrismaAdapter(prisma as never, storage as never, taxonomy as never);
    const now = new Date('2026-10-13T02:34:56.000Z');

    const result = await repository.applyAdminAction({
      auctionUuid: row.auctionUuid,
      action: 'hide',
      actor: 'operator',
      reason: '신고 검토 중',
      now,
    });

    expect(result.getOperationalStatus(now)).toBe('hidden');
    expect(tx.auctions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { auctionUuid: row.auctionUuid, version: row.version },
        data: expect.objectContaining({ status: 'hidden', version: { increment: 1 } }),
      }),
    );
    expect(tx.auctionAdminActions.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        auctionUuid: row.auctionUuid,
        actor: 'operator',
        action: 'hide',
        reason: '신고 검토 중',
        previousStatus: 'active',
        nextStatus: 'hidden',
      }),
    });
    expect(tx.outbox.create).toHaveBeenCalledOnce();
  });

  it('combines the admin search and cursor filters', async () => {
    const prisma = {
      auctions: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const repository = new AuctionPrismaAdapter(prisma as never, {} as never, {} as never);

    await repository.findAuctions({
      type: 'admin',
      query: 'camera',
      cursor: {
        createdAt: new Date('2026-10-12T01:00:00.000Z'),
        auctionUuid: row.auctionUuid,
      },
    });

    const where = prisma.auctions.findMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0]).toMatchObject({ OR: [{ title: { contains: 'camera' } }] });
    expect(where.AND[1]).toHaveProperty('OR');
  });
});
