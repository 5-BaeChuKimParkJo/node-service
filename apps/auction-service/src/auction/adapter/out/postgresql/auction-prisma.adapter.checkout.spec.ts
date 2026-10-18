import { AuctionPrismaAdapter } from './auction-prisma.adapter';

describe('AuctionPrismaRepository checkout bid guards', () => {
  const uuid = '10000000-0000-0000-0000-000000000000';
  const bidder = '20000000-0000-0000-0000-000000000000';
  const makeRepository = () => {
    const tx = {
      auctions: { update: vi.fn().mockRejectedValue(new Error('No eligible row')) },
      outbox: { create: vi.fn() },
    };
    return { tx, repository: new AuctionPrismaAdapter(tx as never, {} as never, {} as never) };
  };

  afterEach(() => vi.useRealTimers());

  it.each(['direct', 'batch'] as const)('guards the %s bid write against frozen or closed auctions', async (mode) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T07:00:00Z'));
    const { tx, repository } = makeRepository();
    if (mode === 'direct') {
      expect(await repository.updateAuctionCurrentBid(uuid, 2000n, bidder, tx as never)).toBe(0);
    } else {
      await expect(repository.updateAuctionCurrent(uuid, 2000n, bidder, tx as never)).rejects.toThrow();
    }
    expect(tx.auctions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          auctionUuid: uuid,
          currentBid: { lt: 2000n },
          status: 'visible',
          deletedAt: null,
          soldAt: null,
          checkoutLockedAt: null,
          startAt: { lte: new Date() },
          endAt: { gt: new Date() },
        }),
      }),
    );
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  it('does not allow seller edits to an already frozen auction', async () => {
    const { repository } = makeRepository();
    const tx = {
      auctions: { update: vi.fn().mockRejectedValue(new Error('Frozen')) },
      outbox: { create: vi.fn() },
    };
    (repository as unknown as { prisma: unknown }).prisma = {
      $transaction: (callback: (transaction: unknown) => unknown) => callback(tx),
    };
    await expect(
      repository.updateAuction({
        getSnapshot: () => ({ auctionUuid: uuid, title: 'Changed title' }),
      } as never),
    ).rejects.toThrow('Frozen');
    expect(tx.auctions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { auctionUuid: uuid, checkoutLockedAt: null },
      }),
    );
  });
});
