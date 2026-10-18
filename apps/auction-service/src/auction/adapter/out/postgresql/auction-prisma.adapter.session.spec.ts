import { AuctionPrismaAdapter } from './auction-prisma.adapter';

describe('AuctionPrismaAdapter atomic bid capability', () => {
  const uuid = '10000000-0000-4000-8000-000000000001';

  function fixture() {
    const tx = { transactionMarker: true };
    const prisma = { $transaction: vi.fn(async (work) => work(tx)) };
    const adapter = new AuctionPrismaAdapter(prisma as never, {} as never, {} as never);
    const auction = { getSnapshot: () => ({ auctionUuid: uuid }) };
    vi.spyOn(adapter, 'findAuctionForUpdate').mockResolvedValue(auction as never);
    vi.spyOn(adapter, 'createAuctionBidder').mockResolvedValue(undefined);
    vi.spyOn(adapter, 'createAuctionBidders').mockResolvedValue(undefined);
    vi.spyOn(adapter, 'updateAuctionCurrent').mockResolvedValue(undefined);
    vi.spyOn(adapter, 'updateAuctionCurrentBid').mockResolvedValue(1);
    return { adapter, tx, prisma, auction };
  }

  it('acquires the row lock and executes all capabilities in the same transaction', async () => {
    const { adapter, tx, prisma, auction } = fixture();
    const bid = { bid: true } as never;
    const bids = { batch: true } as never;
    const result = await adapter.withLockedAuction(uuid, async (session) => {
      expect(adapter.findAuctionForUpdate).toHaveBeenCalledWith(uuid, tx);
      expect(session.auction).toBe(auction);
      expect(Object.keys(session).sort()).toEqual([
        'auction',
        'createBid',
        'createBids',
        'updateCurrent',
        'updateCurrentBid',
      ]);
      await session.createBid(bid);
      await session.createBids(bids);
      await session.updateCurrent(16000n, 'bidder');
      return session.updateCurrentBid(17000n, 'bidder');
    });
    expect(result).toBe(1);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(adapter.createAuctionBidder).toHaveBeenCalledWith(bid, tx);
    expect(adapter.createAuctionBidders).toHaveBeenCalledWith(bids, tx);
    expect(adapter.updateAuctionCurrent).toHaveBeenCalledWith(uuid, 16000n, 'bidder', tx);
    expect(adapter.updateAuctionCurrentBid).toHaveBeenCalledWith(uuid, 17000n, 'bidder', tx);
  });

  it('propagates callback failure to the transaction owner', async () => {
    const { adapter } = fixture();
    const failure = new Error('Abort atomic bid');
    await expect(
      adapter.withLockedAuction(uuid, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });
});
