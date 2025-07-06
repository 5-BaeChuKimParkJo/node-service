import { Injectable } from '@nestjs/common';
import { AuctionCachePort } from '../../../application/port/out/auction-cache.port';
import { RedisService } from '@app/common/redis/redis.service';

@Injectable()
export class AuctionRedisCache extends AuctionCachePort {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  override increaseViewCount = async (auctionUuid: string, count: number): Promise<void> => {
    await this.redisService.sadd('auction:view:keys', `auction:view:${auctionUuid}`);
    await this.redisService.incrby(`auction:view:${auctionUuid}`, count);
  };
}
