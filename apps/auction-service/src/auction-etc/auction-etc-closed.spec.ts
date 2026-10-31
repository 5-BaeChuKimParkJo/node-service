import { AuctionEtcService } from './auction-etc.service';
vi.mock('@app/common/kafka/kafka.service', () => ({ KafkaService: class KafkaService {} }));
describe('Kafka bid processor protected auction states', () => {
  const now = new Date('2026-10-31T01:00:00Z');
  const fixture = () => ({
    auctionId: 1n,
    auctionUuid: '10000000-0000-4000-8000-000000000001',
    sellerUuid: '20000000-0000-4000-8000-000000000002',
    minimumBid: 1000n,
    currentBid: 0n,
    currentBidderUuid: null,
    status: 'visible',
    deletedAt: null,
    soldAt: null,
    checkoutLockedAt: null,
    startAt: new Date('2026-10-31T00:00:00Z'),
    endAt: new Date('2026-10-31T02:00:00Z'),
  });
  afterEach(() => vi.useRealTimers());
  async function rejects(patch: Record<string, unknown>, afterLock?: Date) {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const row = { ...fixture(), ...patch };
    const tx = { $executeRawUnsafe: vi.fn(), auctionBidders: { createMany: vi.fn() } };
    const notices = { sendBidMessages: vi.fn() };
    const repository = {
      findAuctionsForUpdate: async () => {
        if (afterLock) vi.setSystemTime(afterLock);
        return [row];
      },
      createAuctionOutbox: vi.fn(),
    };
    const service = new AuctionEtcService(
      { $transaction: async (work: (value: typeof tx) => Promise<unknown>) => work(tx) } as never,
      repository as never,
      notices as never,
      {} as never,
      {} as never,
    );
    await service.bidAuctionBatch([
      {
        auctionUuid: row.auctionUuid,
        bidderUuid: '30000000-0000-4000-8000-000000000003',
        bidAmount: 1000,
        createdAt: now,
        requestId: '40000000-0000-4000-8000-000000000004',
      },
    ]);
    expect(notices.sendBidMessages).toHaveBeenCalledWith([expect.objectContaining({ type: 'rejected-period' })]);
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(tx.auctionBidders.createMany).toHaveBeenCalledWith({ data: [] });
    expect(repository.createAuctionOutbox).toHaveBeenCalledWith([], 'u', tx);
  }
  it.each([
    { status: 'cancelled' },
    { status: 'hidden' },
    { deletedAt: now },
    { soldAt: now },
    { checkoutLockedAt: now },
  ])('rejects protected state %# before accepting a financial/event write', (patch) => rejects(patch));
  it('rejects exactly at the end boundary', () => rejects({ endAt: now }));
  it('checks the period after row lock acquisition rather than before the transaction', () =>
    rejects({}, new Date('2026-10-31T03:00:00Z')));
});
