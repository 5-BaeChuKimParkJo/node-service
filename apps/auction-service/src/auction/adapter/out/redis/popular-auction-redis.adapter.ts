import { Injectable } from '@nestjs/common';
import { RedisService } from '@app/common/redis/redis.service';
import { z } from 'zod';
import { PopularAuctionCachePort } from '../../../application/port/out/popular-auction-cache.port';
import { PopularAuctionSnapshot } from '../../../application/model/popular-auctions.result';

const count = z.string().regex(/^(0|[1-9]\d*)$/);
const snapshotSchema = z
  .object({
    generatedAt: z.string().datetime(),
    scores: z
      .array(
        z.object({
          auctionUuid: z.string().uuid(),
          uniqueViewers: count,
          uniqueBidders: count,
          score: z.string().regex(/^[1-9]\d*$/),
        }),
      )
      .max(10),
  })
  .refine(({ scores }) => new Set(scores.map((score) => score.auctionUuid)).size === scores.length);
const key = 'auction:popular:v1:24h';

@Injectable()
export class PopularAuctionRedisAdapter extends PopularAuctionCachePort {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async read(): Promise<PopularAuctionSnapshot | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    const parsed = snapshotSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  }

  async write(snapshot: PopularAuctionSnapshot): Promise<void> {
    await this.redis.set(key, JSON.stringify(snapshot), 'EX', 300);
  }
}
