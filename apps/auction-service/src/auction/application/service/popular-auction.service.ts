import { Injectable, Logger } from '@nestjs/common';
import { PopularAuctionRepositoryPort } from '../port/out/popular-auction-repository.port';
import { PopularAuctionCachePort } from '../port/out/popular-auction-cache.port';
import { PopularAuctionsResult, PopularAuctionSnapshot } from '../model/popular-auctions.result';

@Injectable()
export class PopularAuctionService {
  private readonly logger = new Logger(PopularAuctionService.name);
  private refreshing: Promise<PopularAuctionSnapshot> | null = null;

  constructor(
    private readonly repository: PopularAuctionRepositoryPort,
    private readonly cache: PopularAuctionCachePort,
  ) {}

  async list(now = new Date()): Promise<PopularAuctionsResult> {
    let snapshot: PopularAuctionSnapshot | null = null;
    try {
      snapshot = await this.withCacheTimeout(() => this.cache.read());
    } catch {
      this.logger.warn('Popular auction cache unavailable; aggregating from PostgreSQL');
    }
    const age = snapshot ? now.getTime() - Date.parse(snapshot.generatedAt) : Number.NaN;
    if (!(age >= 0 && age < 300000)) snapshot = await this.refresh(now);

    const { scores, generatedAt } = snapshot!;
    const listings = await this.repository.findActive(
      scores.map((score) => score.auctionUuid),
      now,
    );
    const byUuid = new Map(listings.map((listing) => [listing.auctionUuid, listing]));
    const items: PopularAuctionsResult['items'] = [];
    for (const score of scores) {
      const listing = byUuid.get(score.auctionUuid);
      if (!listing) continue;
      items.push({
        auctionUuid: listing.auctionUuid,
        title: listing.title,
        thumbnailUrl: listing.thumbnailUrl,
        minimumBid: listing.minimumBid.toString(),
        currentBid: (listing.currentBid > 0n ? listing.currentBid : listing.minimumBid).toString(),
        startAt: listing.startAt.toISOString(),
        endAt: listing.endAt.toISOString(),
        rank: items.length + 1,
        uniqueViewers: score.uniqueViewers,
        uniqueBidders: score.uniqueBidders,
        score: score.score,
      });
    }
    return { items, generatedAt, windowHours: 24 };
  }

  async refresh(now = new Date()): Promise<PopularAuctionSnapshot> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const scores = await this.repository.rank(now);
      const snapshot = { generatedAt: now.toISOString(), scores };
      try {
        await this.withCacheTimeout(() => this.cache.write(snapshot));
      } catch {
        this.logger.warn('Popular auction cache write failed');
      }
      return snapshot;
    })();
    try {
      return await this.refreshing;
    } finally {
      this.refreshing = null;
    }
  }

  recordView(command: { auctionUuid: string; viewerUuid: string }, now = new Date()): Promise<void> {
    return this.repository.recordView(command, now);
  }

  private async withCacheTimeout<T>(operation: () => Promise<T>): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Popular auction cache timed out')), 1000);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }
}
