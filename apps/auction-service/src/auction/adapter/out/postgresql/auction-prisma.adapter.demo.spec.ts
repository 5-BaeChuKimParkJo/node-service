import { AuctionPrismaAdapter } from './auction-prisma.adapter';
import { PrismaService } from '../../../../prisma/prisma.service';
import { S3Service } from '@app/common/s3/s3.service';
import { TaxonomyUseCase } from '../../../../taxonomy/application/port/in/taxonomy.use-case';
import NewAuction from '../../../domain/model/new-auction';

const templateUuid = '10000000-0000-4000-8000-000000000001';
const sellerUuid = '20000000-0000-4000-8000-000000000001';
const key = `${sellerUuid}_30000000-0000-4000-8000-000000000001.webp`;
const now = new Date('2026-10-25T01:30:00Z');
const context = { templateUuid, mode: 'automatic' as const, now };
const input = new NewAuction(
  {
    title: '[DEMO] Camera fixture',
    description: 'Camera fixture',
    minimumBid: 1000n,
    startAt: new Date('2026-10-25T01:00:00Z'),
    endAt: new Date('2026-10-26T01:00:00Z'),
    isDirectDeal: false,
    directDealLocation: null,
    productCondition: 'used',
    categoryId: 1,
    tagIds: [],
    thumbnailKey: key,
    images: [{ key, order: 0 }],
  },
  { memberUuid: sellerUuid, role: 'member' },
);

describe('AuctionPrismaAdapter managed demo transaction', () => {
  const source = { title: '[DEMO-016] Fixture', status: 'visible', deletedAt: null, sellerUuid, thumbnailKey: key };
  const tx = {
    $queryRaw: vi.fn(),
    auctions: { findFirst: vi.fn(), create: vi.fn() },
    outbox: { create: vi.fn() },
  };
  const prisma = { $transaction: vi.fn(async (work) => work(tx)) };
  const adapter = new AuctionPrismaAdapter(
    prisma as unknown as PrismaService,
    { toFullUrl: (value: string) => `/fixture/${value}` } as S3Service,
    { resolveNames: vi.fn().mockResolvedValue({ categoryName: 'Camera', tagNames: [] }) } as unknown as TaxonomyUseCase,
  );
  beforeEach(() => {
    vi.clearAllMocks();
    tx.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([source]);
    tx.auctions.findFirst.mockReset().mockResolvedValue(null);
    tx.auctions.create.mockReset().mockResolvedValue({
      ...input.getSnapshot(),
      auctionId: 2n,
      auctionUuid: '50000000-0000-4000-8000-000000000001',
      currentBidderUuid: null,
      soldAt: null,
      viewCount: 0n,
      version: 0,
      createdAt: now,
      demoTemplateUuid: templateUuid,
      auctionImages: [{ auctionImageId: 1n, key, order: 0 }],
    });
    tx.outbox.create.mockReset().mockResolvedValue({});
  });

  it('writes private provenance and the unchanged public creation event in one transaction', async () => {
    const result = await adapter.createDemoAuction(input, context);
    expect(result.status).toBe('created');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.auctions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ demoTemplateUuid: templateUuid, currentBid: 0n }),
      }),
    );
    const event = tx.outbox.create.mock.calls[0][0].data;
    expect(event).toMatchObject({
      eventType: 'AuctionCreated',
      op: 'c',
      aggregateId: '50000000-0000-4000-8000-000000000001',
    });
    expect(event.payload).not.toHaveProperty('demoTemplateUuid');
    expect(result.status === 'created' && result.auction.getSnapshot()).toHaveProperty(
      'demoTemplateUuid',
      templateUuid,
    );
  });

  it('returns promptly without a write when another run owns the lock', async () => {
    tx.$queryRaw.mockReset().mockResolvedValue([{ locked: false }]);
    await expect(adapter.createDemoAuction(input, context)).resolves.toEqual({ status: 'skipped-busy' });
    expect(tx.auctions.create).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  it('does not insert another automatic auction when a candidate is active', async () => {
    tx.auctions.findFirst.mockResolvedValue({ auctionUuid: templateUuid });
    await expect(adapter.createDemoAuction(input, context)).resolves.toEqual({ status: 'skipped-active' });
    expect(tx.auctions.create).not.toHaveBeenCalled();
  });

  it('allows an intentional manual override while participating in the same lock protocol', async () => {
    await expect(adapter.createDemoAuction(input, { ...context, mode: 'manual' })).resolves.toMatchObject({
      status: 'created',
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.auctions.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    { ...source, status: 'hidden' },
    { ...source, deletedAt: now },
    { ...source, title: 'Ordinary auction' },
    { ...source, sellerUuid: templateUuid },
  ])('rejects changed source eligibility before inserting: %j', async (changed) => {
    tx.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([changed]);
    await expect(adapter.createDemoAuction(input, context)).rejects.toMatchObject({ status: 409 });
    expect(tx.auctions.create).not.toHaveBeenCalled();
  });
});
