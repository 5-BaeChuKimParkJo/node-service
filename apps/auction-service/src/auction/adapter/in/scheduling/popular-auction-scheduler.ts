import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PopularAuctionService } from '../../../application/service/popular-auction.service';

@Injectable()
export class PopularAuctionScheduler {
  private readonly logger = new Logger(PopularAuctionScheduler.name);

  constructor(private readonly popular: PopularAuctionService) {}

  @Cron('0 */5 * * * *', { waitForCompletion: true })
  async refresh(): Promise<void> {
    try {
      await this.popular.refresh();
    } catch {
      this.logger.warn('Popular auction refresh failed; the next request can retry');
    }
  }
}
