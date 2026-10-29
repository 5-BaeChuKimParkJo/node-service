import { CreateAuctionService } from './create-auction.service';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { AuctionFileStoragePort } from '../port/out/auction-file-storage-port';
import { TaxonomyUseCase } from '../../../taxonomy/application/port/in/taxonomy.use-case';
import { AuctionMapper } from '../mapper/auction.mapper';
import { CreateAuctionCommand } from '../model/create-auction.command';
import NewAuction from '../../domain/model/new-auction';
import Auction from '../../domain/model/auction';
import { AuctionService } from './auction.service';
import { AuctionWebMapper } from '../../adapter/in/web/mapper/auction-web.mapper';
import AuctionUpdate from '../../domain/model/auction-update';

const sellerUuid = '20000000-0000-4000-8000-000000000001';
const key = `${sellerUuid}_30000000-0000-4000-8000-000000000001.webp`;
const context = {
  templateUuid: '10000000-0000-4000-8000-000000000001',
  mode: 'automatic' as const,
  now: new Date('2026-10-25T01:30:00Z'),
};
const command: CreateAuctionCommand = {
  title: '[DEMO] Camera fixture',
  description: 'Portfolio fixture',
  categoryId: 1,
  minimumBid: 1000n,
  tagIds: [],
  productCondition: 'used',
  isDirectDeal: false,
  directDealLocation: null,
  thumbnailKey: key,
  images: [{ key, order: 0 }],
  startAt: new Date('2026-10-25T01:00:00Z'),
  endAt: new Date('2026-10-26T01:00:00Z'),
};
const user = { memberUuid: sellerUuid, role: 'member' as const };

function stored(input: NewAuction) {
  return new Auction({
    ...input.getSnapshot(),
    auctionId: 2n,
    auctionUuid: '50000000-0000-4000-8000-000000000001',
    currentBidderUuid: null,
    viewCount: 0n,
    version: 0,
    soldAt: null,
    createdAt: context.now,
    images: [{ auctionImageId: 1n, key, order: 0 }],
  });
}

describe('CreateAuctionService demo boundary', () => {
  const repository = {
    createAuction: vi.fn(async (input: NewAuction) => stored(input)),
    createDemoAuction: vi.fn(async (input: NewAuction) => ({ status: 'created', auction: stored(input) })),
  };
  const storage = { checkFileExists: vi.fn(), toFullUrl: (value: string) => `/fixture/${value}` };
  const taxonomy = { validateSelection: vi.fn(), resolveNames: vi.fn() };
  const service = new CreateAuctionService(
    repository as unknown as AuctionRepositoryPort,
    storage as unknown as AuctionFileStoragePort,
    new AuctionMapper(storage as unknown as AuctionFileStoragePort),
    taxonomy as unknown as TaxonomyUseCase,
  );
  beforeEach(() => {
    repository.createAuction.mockClear();
    repository.createDemoAuction
      .mockReset()
      .mockImplementation(async (input) => ({ status: 'created', auction: stored(input) }));
    storage.checkFileExists.mockReset().mockResolvedValue(undefined);
    taxonomy.validateSelection.mockReset().mockResolvedValue(undefined);
    taxonomy.resolveNames.mockReset().mockResolvedValue({ categoryName: 'Camera', tagNames: [] });
  });

  it('completes real preflight before the atomic demo write and returns an owned result', async () => {
    let finish!: () => void;
    storage.checkFileExists.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const result = service.executeDemo(command, user, context);
    await vi.waitFor(() => expect(storage.checkFileExists).toHaveBeenCalledWith({ key }));
    expect(repository.createDemoAuction).not.toHaveBeenCalled();
    finish();
    await expect(result).resolves.toMatchObject({
      status: 'created',
      auction: {
        auctionUuid: '50000000-0000-4000-8000-000000000001',
        minimumBid: 1000n,
        thumbnailUrl: `/fixture/${key}`,
        categoryName: 'Camera',
        tagNames: [],
      },
    });
    expect(repository.createDemoAuction).toHaveBeenCalledWith(expect.any(NewAuction), context);
    expect(repository.createAuction).not.toHaveBeenCalled();
  });

  it.each(['skipped-active', 'skipped-busy'])(
    'passes through %s without post-write lookups or retrying',
    async (status) => {
      repository.createDemoAuction.mockResolvedValue({ status } as never);
      await expect(service.executeDemo(command, user, context)).resolves.toEqual({ status });
      expect(taxonomy.resolveNames).not.toHaveBeenCalled();
      expect(repository.createDemoAuction).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['taxonomy', 'storage', 'ownership', 'domain'])(
    'never writes after a %s validation failure',
    async (failure) => {
      if (failure === 'taxonomy') taxonomy.validateSelection.mockRejectedValue(new Error('Invalid category'));
      if (failure === 'storage') storage.checkFileExists.mockRejectedValue(new Error('Missing image'));
      const input = {
        ...command,
        ...(failure === 'ownership' ? { images: [{ key: 'someone-else/image.webp', order: 0 }] } : {}),
        ...(failure === 'domain' ? { minimumBid: 999n } : {}),
      };
      await expect(service.executeDemo(input, user, context)).rejects.toBeDefined();
      expect(repository.createDemoAuction).not.toHaveBeenCalled();
      expect(repository.createAuction).not.toHaveBeenCalled();
    },
  );

  it('keeps ordinary creation on its original unmarked write path', async () => {
    await expect(service.execute(command, user)).resolves.toMatchObject({
      auctionUuid: '50000000-0000-4000-8000-000000000001',
      minimumBid: 1000n,
    });
    expect(repository.createAuction).toHaveBeenCalledTimes(1);
    expect(repository.createDemoAuction).not.toHaveBeenCalled();
    expect(repository.createAuction.mock.calls[0][0].getSnapshot()).not.toHaveProperty('demoTemplateUuid');
  });

  it.each([
    [5, '2026-10-25T01:35:00.000Z'],
    [30, '2026-10-25T02:00:00.000Z'],
  ])('persists and reads a trusted %i-minute demo through real domain validation', async (_minutes, end) => {
    const input = { ...command, startAt: context.now, endAt: new Date(end) };
    await expect(service.executeDemo(input, user, context)).resolves.toMatchObject({
      status: 'created',
      auction: { startAt: context.now, endAt: new Date(end) },
    });
    await expect(service.execute(input, user)).rejects.toBeDefined();
    expect(repository.createAuction).not.toHaveBeenCalled();
  });

  it.each([null, context.templateUuid])(
    'derives a public demo boolean only from stored provenance: %s',
    async (demoTemplateUuid) => {
      const row = new Auction({ ...stored(new NewAuction(command, user)).getSnapshot(), demoTemplateUuid });
      const detail = new AuctionService(
        { findAuction: async () => row } as unknown as AuctionRepositoryPort,
        new AuctionMapper(storage as unknown as AuctionFileStoragePort),
        taxonomy as unknown as TaxonomyUseCase,
      );
      const result = AuctionWebMapper.fromResponse(
        await detail.execute({ type: 'user', auctionUuid: row.getSnapshot().auctionUuid }),
      );
      expect(result.isDemo).toBe(demoTemplateUuid !== null);
      expect(result).not.toHaveProperty('demoTemplateUuid');
    },
  );

  it('keeps the whole-hour rule on ordinary creation and date updates even with a demo title', async () => {
    const input = { ...command, startAt: context.now, endAt: new Date('2026-10-25T02:30:00Z') };
    await expect(service.execute(input, user)).rejects.toBeDefined();
    expect(
      () => new AuctionUpdate({ auctionUuid: context.templateUuid, endAt: input.endAt }, { ...user, role: 'admin' }),
    ).toThrow();
    expect(repository.createAuction).not.toHaveBeenCalled();
  });
});
