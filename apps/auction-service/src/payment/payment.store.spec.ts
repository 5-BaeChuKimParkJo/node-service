import { PrismaPaymentStore } from './payment.store';
import { PaymentService } from './payment.service';
import { auctionUuid, buyerUuid, sellerUuid, fixture } from './payment.test-fixtures';

describe('payment PostgreSQL transaction boundary', () => {
  function database() {
    const f = fixture();
    let acquired = false;
    const tx = {
      $queryRaw: vi.fn(async () => { acquired = true; return [{ auctionUuid }]; }),
      auctions: {
        findUnique: vi.fn(async () => {
          if (!acquired) throw new Error('winner read before auction lock');
          return { ...f.store.state.auction, currentBid: 27000n, currentBidderUuid: sellerUuid, sellerUuid: buyerUuid };
        }),
        update: vi.fn(async () => ({})),
      },
      auctionPurchase: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
      auctionPaymentAttempt: { upsert: vi.fn(async () => ({})) },
    };
    const prisma = { ...tx, $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
    const repository = new PrismaPaymentStore(prisma as never);
    const service = new PaymentService(repository, f.provider, f.config);
    return { repository, service, prisma, tx };
  }

  it('locks the auction before reading winner/price and persists the frozen purchase and lock in the same transaction', async () => {
    const { service, tx, prisma } = database();
    const result = await service.prepare(auctionUuid, sellerUuid);
    expect(result.purchase).toMatchObject({ buyerUuid: sellerUuid, sellerUuid: buyerUuid, amount: '27000' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const [sql, uuid] = tx.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, string];
    expect(sql.join('?')).toMatch(/SELECT "auctionUuid" FROM "Auctions" WHERE "auctionUuid" = \?::uuid FOR UPDATE/);
    expect(uuid).toBe(auctionUuid);
    expect(tx.auctions.update).toHaveBeenCalledWith({ where: { auctionUuid }, data: { checkoutLockedAt: expect.any(Date) } });
    expect(tx.auctionPurchase.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ amount: 27000n, buyerUuid: sellerUuid }) }));
    expect(tx.auctionPaymentAttempt.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({
      confirmIdempotencyKey: expect.any(String), cancelIdempotencyKey: expect.any(String), status: 'READY', attemptNumber: 1,
    }) }));
  });

  it('does not freeze or create a purchase for a disappeared auction', async () => {
    const { service, tx } = database();
    tx.$queryRaw.mockResolvedValue([]);
    await expect(service.prepare(auctionUuid, buyerUuid)).rejects.toMatchObject({ status: 404 });
    expect(tx.auctions.findUnique).not.toHaveBeenCalled();
    expect(tx.auctions.update).not.toHaveBeenCalled();
    expect(tx.auctionPurchase.upsert).not.toHaveBeenCalled();
  });

  it('uses ordinary reads for GET without starting a transaction or taking a lock', async () => {
    const { repository, prisma, tx } = database();
    tx.auctions.findUnique.mockResolvedValue(fixture().store.state.auction);
    await repository.read(auctionUuid);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.auctions.update).not.toHaveBeenCalled();
    expect(tx.auctionPurchase.upsert).not.toHaveBeenCalled();
  });
});
