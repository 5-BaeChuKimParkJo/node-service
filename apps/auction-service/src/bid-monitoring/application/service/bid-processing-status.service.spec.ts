import { BidProcessingStatusService } from './bid-processing-status.service';
import { BidProcessingStateService } from './bid-processing-state.service';
import type { BidBrokerPort } from '../port/out/bid-broker.port';

describe('bid processing status', () => {
  afterEach(() => vi.useRealTimers());

  it('coalesces concurrent refreshes and expires its five-second cache', async () => {
    vi.useFakeTimers();
    const snapshot = vi
      .fn()
      .mockResolvedValue({ groupState: 'Stable', lag: '9007199254740997', dlqRetained: '2', retentionGap: false });
    const service = new BidProcessingStatusService({ snapshot } as BidBrokerPort, new BidProcessingStateService());
    const [first, second] = await Promise.all([service.get(), service.get()]);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ broker: 'available', lag: '9007199254740997' });
    await service.get();
    expect(snapshot).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5001);
    await service.get();
    expect(snapshot).toHaveBeenCalledTimes(2);
  });

  it('returns unknown counters and fixed error history without exposing transport errors', async () => {
    const state = new BidProcessingStateService();
    state.recordError('DLQ_PUBLICATION_FAILED');
    const service = new BidProcessingStatusService(
      { snapshot: vi.fn().mockRejectedValue(new Error('password=secret broker.internal')) },
      state,
    );
    const result = await service.get();
    expect(result).toMatchObject({
      broker: 'unavailable',
      lag: null,
      dlqRetained: null,
      groupState: null,
      retentionGap: null,
      lastAcknowledgedAt: null,
      lastError: { code: 'DLQ_PUBLICATION_FAILED' },
    });
    expect(JSON.stringify(result)).not.toMatch(/secret|broker.internal/);
    expect(Date.parse(result.startedAt)).not.toBeNaN();
  });

  it('keeps recent historical error after recovery and snapshots state without writable references', () => {
    const state = new BidProcessingStateService();
    state.recordError('BID_PROCESSING_FAILED');
    state.recordAcknowledgement();
    const first = state.snapshot();
    expect(first.lastAcknowledgedAt).not.toBeNull();
    expect(first.lastError?.code).toBe('BID_PROCESSING_FAILED');
    if (first.lastError) first.lastError.code = 'OFFSET_COMMIT_FAILED';
    expect(state.snapshot().lastError?.code).toBe('BID_PROCESSING_FAILED');
  });
});
