import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DemoAuctionService } from '../../../application/service/demo-auction.service';
import { CreateAuctionResult } from '../../../application/model/create-auction.result';
import { DemoAuctionScheduler } from './demo-auction-scheduler';

describe('DemoAuctionScheduler', () => {
  const auctionUuid = '50000000-0000-4000-8000-000000000001';
  const ensureActive = vi.fn();
  let log: ReturnType<typeof vi.spyOn>;
  let debug: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  const scheduler = (enabled?: unknown) =>
    new DemoAuctionScheduler(
      { ensureActive } as unknown as DemoAuctionService,
      new ConfigService({ DEMO_AUCTION_AUTO_ENABLED: enabled }),
    );

  beforeEach(() => {
    ensureActive.mockReset().mockResolvedValue({ status: 'skipped-active' });
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([undefined, 'false', '1', 'TRUE', true])('does no work when enabled is %s', async (enabled) => {
    await scheduler(enabled).replenish();
    expect(ensureActive).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('logs only the new UUID after one enabled tick without starting work at construction', async () => {
    ensureActive.mockResolvedValue({
      status: 'created',
      auction: { auctionUuid, description: 'private fixture description' } as CreateAuctionResult,
    });
    const job = scheduler('true');
    expect(ensureActive).not.toHaveBeenCalled();
    await job.replenish();
    expect(ensureActive).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual([expect.stringContaining(auctionUuid)]);
    expect(JSON.stringify(log.mock.calls)).not.toContain('private fixture description');
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(['skipped-active', 'skipped-busy'])('reports %s without retrying', async (status) => {
    ensureActive.mockResolvedValue({ status });
    await scheduler('true').replenish();
    expect(ensureActive).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledWith(expect.stringContaining(status));
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('contains a failed tick without logging secrets and lets the next tick run', async () => {
    ensureActive.mockRejectedValueOnce(new Error('secret database credentials'));
    const job = scheduler('true');
    await expect(job.replenish()).resolves.toBeUndefined();
    expect(ensureActive).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret');
    await job.replenish();
    expect(ensureActive).toHaveBeenCalledTimes(2);
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('skipped-active'));
  });
});
