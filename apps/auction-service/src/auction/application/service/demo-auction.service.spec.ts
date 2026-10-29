import { DemoAuctionService } from './demo-auction.service';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { CreateAuctionUseCase } from '../port/in/create-auction.use-case';
import { CreateAuctionResult } from '../model/create-auction.result';
import NewAuction from '../../domain/model/new-auction';
import AdminAuction from '../../domain/model/admin-auction';

const templateUuid = '10000000-0000-4000-8000-000000000001';
const sellerUuid = '20000000-0000-4000-8000-000000000001';
const imageKey = `${sellerUuid}_30000000-0000-4000-8000-000000000001.webp`;
const now = new Date('2026-10-20T09:35:00Z');

function fixture(overrides: Record<string, unknown> = {}) {
  return new AdminAuction({
    auctionId: 1n,
    auctionUuid: templateUuid,
    categoryId: 1,
    title: '[DEMO-016] Camera fixture',
    description: 'Fixture camera',
    minimumBid: 30000n,
    currentBid: 50000n,
    currentBidderUuid: '40000000-0000-4000-8000-000000000001',
    startAt: new Date('2026-10-01T00:00:00Z'),
    endAt: new Date('2026-10-02T00:00:00Z'),
    soldAt: new Date('2026-10-02T00:00:00Z'),
    isDirectDeal: false,
    directDealLocation: null,
    status: 'visible',
    productCondition: 'used',
    viewCount: 400n,
    thumbnailKey: imageKey,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: now,
    deletedAt: null,
    sellerUuid,
    version: 10,
    tagIds: [1],
    images: [{ auctionImageId: 1n, key: imageKey, order: 0 }],
    ...overrides,
  });
}

describe('DemoAuctionService', () => {
  const template = fixture();
  const repository = { findAuction: vi.fn().mockResolvedValue(template) };
  const created = {
    auctionUuid: '50000000-0000-4000-8000-000000000001',
    title: '[DEMO] Camera fixture',
    startAt: new Date('2026-10-20T09:00:00Z'),
    endAt: new Date('2026-10-21T09:00:00Z'),
  } as CreateAuctionResult;
  const creator = {
    execute: vi.fn().mockResolvedValue(created),
    executeDemo: vi.fn().mockResolvedValue({ status: 'created', auction: created }),
  };
  const service = (id = templateUuid) =>
    new DemoAuctionService(
      repository as unknown as AuctionRepositoryPort,
      creator as unknown as CreateAuctionUseCase,
      id,
    );

  beforeEach(() => {
    repository.findAuction.mockReset().mockResolvedValue(template);
    creator.execute.mockReset().mockResolvedValue(created);
    creator.executeDemo.mockReset().mockResolvedValue({ status: 'created', auction: created });
  });

  it('creates a fresh labelled active auction through the normal creation use case without copying bids or changing its template', async () => {
    const before = structuredClone(template.getSnapshot());
    await expect(service().create(now)).resolves.toEqual({
      auctionUuid: created.auctionUuid,
      title: created.title,
      startAt: '2026-10-20T09:00:00.000Z',
      endAt: '2026-10-21T09:00:00.000Z',
    });
    expect(repository.findAuction).toHaveBeenCalledWith({ type: 'admin', auctionUuid: templateUuid });
    expect(creator.executeDemo).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), {
      templateUuid,
      mode: 'manual',
      now,
    });
    const [command, seller] = creator.executeDemo.mock.calls[0];
    expect(command).toEqual({
      title: '[DEMO] Camera fixture',
      description: expect.stringContaining('체험용'),
      categoryId: 1,
      tagIds: [1],
      minimumBid: 1000n,
      startAt: new Date('2026-10-20T09:00:00Z'),
      endAt: new Date('2026-10-21T09:00:00Z'),
      isDirectDeal: false,
      directDealLocation: null,
      productCondition: 'used',
      thumbnailKey: imageKey,
      images: [{ key: imageKey, order: 0 }],
    });
    expect(seller).toEqual({ memberUuid: sellerUuid, role: 'member' });
    const fresh = new NewAuction(command, seller).getSnapshot();
    expect(fresh.currentBid).toBe(0n);
    expect(fresh.status).toBe('visible');
    expect(template.getSnapshot()).toEqual(before);
    expect(creator.executeDemo).toHaveBeenCalledTimes(1);
    expect(creator.execute).not.toHaveBeenCalled();
  });

  it.each(['', 'not-a-uuid'])('fails closed without a valid configured template: %s', async (id) => {
    await expect(service(id).create(now)).rejects.toMatchObject({ status: 503 });
    expect(repository.findAuction).not.toHaveBeenCalled();
    expect(creator.execute).not.toHaveBeenCalled();
    expect(creator.executeDemo).not.toHaveBeenCalled();
  });

  it.each([{ title: 'A regular auction' }, { status: 'hidden' }, { status: 'cancelled' }, { deletedAt: now }])(
    'rejects ordinary, hidden, cancelled or deleted source data: %j',
    async (overrides) => {
      repository.findAuction.mockResolvedValue(fixture(overrides));
      await expect(service().create(now)).rejects.toMatchObject({ status: 409 });
      expect(creator.execute).not.toHaveBeenCalled();
      expect(creator.executeDemo).not.toHaveBeenCalled();
    },
  );

  it('keeps bounded fields and preserves creation failures without retrying or claiming success', async () => {
    repository.findAuction.mockResolvedValue(
      fixture({ title: `[DEMO] ${'a'.repeat(93)}`, description: 'b'.repeat(1000) }),
    );
    creator.executeDemo.mockRejectedValue(new Error('storage unavailable'));
    await expect(service().create(now)).rejects.toThrow('storage unavailable');
    const [command] = creator.executeDemo.mock.calls[0];
    expect(command.title.length).toBeLessThanOrEqual(100);
    expect(command.description.length).toBeLessThanOrEqual(1000);
    expect(creator.executeDemo).toHaveBeenCalledTimes(1);
  });

  it.each(['skipped-active', 'skipped-busy'] as const)(
    'forwards an automatic %s outcome without retrying',
    async (status) => {
      creator.executeDemo.mockResolvedValue({ status });
      await expect(service().ensureActive(now)).resolves.toEqual({ status });
      expect(creator.executeDemo).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), {
        templateUuid,
        mode: 'automatic',
        now,
      });
      expect(creator.executeDemo).toHaveBeenCalledTimes(1);
      expect(creator.execute).not.toHaveBeenCalled();
    },
  );

  it('returns a conflict on manual contention without retrying or claiming success', async () => {
    creator.executeDemo.mockResolvedValue({ status: 'skipped-busy' });
    await expect(service().create(now)).rejects.toMatchObject({ status: 409 });
    expect(creator.executeDemo).toHaveBeenCalledTimes(1);
  });

  it.each([
    [5, '2026-10-20T09:40:00.000Z'],
    [30, '2026-10-20T10:05:00.000Z'],
  ])('starts a %i-minute manual demo immediately without rounding its end', async (minutes, end) => {
    await service().create(now, minutes as 5 | 30);
    const [command] = creator.executeDemo.mock.calls[0];
    expect(command.startAt.toISOString()).toBe('2026-10-20T09:35:00.000Z');
    expect(command.endAt.toISOString()).toBe(end);
    expect(command.minimumBid).toBe(1000n);
  });
});
