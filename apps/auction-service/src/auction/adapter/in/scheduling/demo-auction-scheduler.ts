import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DemoAuctionService } from '../../../application/service/demo-auction.service';

@Injectable()
export class DemoAuctionScheduler {
  private readonly logger = new Logger(DemoAuctionScheduler.name);

  constructor(
    private readonly demos: DemoAuctionService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 */5 * * * *', { waitForCompletion: true })
  async replenish(): Promise<void> {
    if (this.config.get('DEMO_AUCTION_AUTO_ENABLED') !== 'true') return;
    try {
      const result = await this.demos.ensureActive();
      if (result.status === 'created') {
        this.logger.log(`Demo auction replenished: ${result.auction.auctionUuid}`);
      } else {
        this.logger.debug(`Demo auction replenishment: ${result.status}`);
      }
    } catch {
      this.logger.warn('Demo auction replenishment failed; waiting for the next scheduled tick');
    }
  }
}
