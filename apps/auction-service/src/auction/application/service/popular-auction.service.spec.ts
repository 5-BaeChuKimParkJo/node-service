import { PopularAuctionService } from './popular-auction.service';
import { PopularAuctionRepositoryPort } from '../port/out/popular-auction-repository.port';
import { PopularAuctionCachePort } from '../port/out/popular-auction-cache.port';
import { PopularAuctionListing, PopularAuctionSnapshot } from '../model/popular-auctions.result';

const now = new Date('2026-10-20T00:00:00.000Z');
const uuid = '10000000-0000-4000-8000-000000000001';
const listing: PopularAuctionListing = {
  auctionUuid: uuid,
  title: 'Camera',
  thumbnailUrl: 'https://fixture.invalid/camera.webp',
  minimumBid: 9007199254740993n,
  currentBid: 9007199254740994n,
  startAt: new Date('2026-10-19T00:00:00Z'),
  endAt: new Date('2026-10-21T00:00:00Z'),
};

class Repository extends PopularAuctionRepositoryPort {
  rankings = 0;
  active: PopularAuctionListing[] = [listing];
  records: Array<{ auctionUuid: string; viewerUuid: string; now: Date }> = [];
  async rank() {
    this.rankings++;
    return [{ auctionUuid: uuid, uniqueViewers: '2', uniqueBidders: '1', score: '7' }];
  }
  async findActive() {
    return this.active;
  }
  async recordView(command: { auctionUuid: string; viewerUuid: string }, at: Date) {
    this.records.push({ ...command, now: at });
  }
}

class Cache extends PopularAuctionCachePort {
  value: PopularAuctionSnapshot | null = null;
  unavailable = false;
  async read() {
    if (this.unavailable) throw new Error('Redis offline');
    return this.value;
  }
  async write(value: PopularAuctionSnapshot) {
    if (this.unavailable) throw new Error('Redis offline');
    this.value = value;
  }
}

describe('popular auctions', () => {
  let repository: Repository;
  let cache: Cache;
  let service: PopularAuctionService;
  beforeEach(() => {
    repository = new Repository();
    cache = new Cache();
    service = new PopularAuctionService(repository, cache);
  });

  it('lazily builds a ranking with exact prices and only public fields', async () => {
    const result = await service.list(now);
    expect(result).toEqual({
      generatedAt: now.toISOString(),
      windowHours: 24,
      items: [
        {
          ...listing,
          rank: 1,
          minimumBid: '9007199254740993',
          currentBid: '9007199254740994',
          startAt: '2026-10-19T00:00:00.000Z',
          endAt: '2026-10-21T00:00:00.000Z',
          uniqueViewers: '2',
          uniqueBidders: '1',
          score: '7',
        },
      ],
    });
    expect(repository.records).toEqual([]);
  });

  it('uses the cached scores but rechecks live auction eligibility on every request', async () => {
    await service.list(now);
    repository.active = [];
    expect((await service.list(new Date(now.getTime() + 1000))).items).toEqual([]);
    expect(repository.rankings).toBe(1);
  });

  it('rebuilds at the five-minute boundary rather than serving old scores', async () => {
    await service.list(now);
    await service.list(new Date(now.getTime() + 299999));
    expect(repository.rankings).toBe(1);
    expect((await service.list(new Date(now.getTime() + 300000))).generatedAt).toBe('2026-10-20T00:05:00.000Z');
    expect(repository.rankings).toBe(2);
  });

  it('does not trust a snapshot generated in the future', async () => {
    cache.value = { generatedAt: '2026-10-21T00:00:00.000Z', scores: [] };
    expect((await service.list(now)).items).toHaveLength(1);
    expect(repository.rankings).toBe(1);
  });

  it('keeps ranking available when Redis fails without inventing a new score', async () => {
    cache.unavailable = true;
    const result = await service.list(now);
    expect(result.items[0]).toMatchObject({ auctionUuid: uuid, score: '7' });
  });

  it('coalesces simultaneous cold requests into one database aggregation', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => service.list(now)));
    expect(results.every((result) => result.items.length === 1)).toBe(true);
    expect(repository.rankings).toBe(1);
  });

  it.each(['read', 'write'] as const)(
    'bounds a pending cache %s so PostgreSQL results remain available',
    async (operation) => {
      vi.useFakeTimers();
      try {
        if (operation === 'read') cache.read = () => new Promise(() => undefined);
        else cache.write = () => new Promise(() => undefined);
        let result: Awaited<ReturnType<PopularAuctionService['list']>> | undefined;
        const request = service.list(now).then((value) => {
          result = value;
        });
        await vi.advanceTimersByTimeAsync(1000);
        expect(result?.items[0]?.score).toBe('7');
        await request;
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('retains score order when the live listing lookup returns a different order', async () => {
    const other = '10000000-0000-4000-8000-000000000002';
    cache.value = {
      generatedAt: now.toISOString(),
      scores: [
        { auctionUuid: other, uniqueViewers: '9', uniqueBidders: '1', score: '14' },
        { auctionUuid: uuid, uniqueViewers: '2', uniqueBidders: '1', score: '7' },
      ],
    };
    repository.active = [listing, { ...listing, auctionUuid: other, currentBid: 0n }];
    expect(
      (await service.list(now)).items.map(({ auctionUuid, rank, currentBid }) => ({ auctionUuid, rank, currentBid })),
    ).toEqual([
      { auctionUuid: other, rank: 1, currentBid: '9007199254740993' },
      { auctionUuid: uuid, rank: 2, currentBid: '9007199254740994' },
    ]);
  });
});
