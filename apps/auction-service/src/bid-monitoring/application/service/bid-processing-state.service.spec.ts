import { BidProcessingStateService } from './bid-processing-state.service';

const context = {
  topic: 'auction-service.bidder.created',
  partition: 2,
  firstOffset: '9007199254740993',
  lastOffset: '9007199254740997',
};

describe('recent bid failure context', () => {
  it('copies only safe fields and isolates input and returned nested state', () => {
    const state = new BidProcessingStateService();
    const input = { ...context, payload: 'private fixture' };
    state.recordError('OFFSET_COMMIT_FAILED', input);
    expect(state.snapshot().lastError?.context).toEqual(context);
    input.firstOffset = '1';
    const first = state.snapshot();
    first.lastError!.context!.lastOffset = '2';
    expect(state.snapshot().lastError?.context).toEqual(context);
    expect(JSON.stringify(state.snapshot())).not.toContain('private fixture');
  });
  it.each([
    undefined,
    { ...context, topic: 'private-topic' },
    { ...context, partition: -1 },
    { ...context, partition: 0.5 },
    { ...context, partition: 2147483648 },
    { ...context, firstOffset: '-1' },
    { ...context, firstOffset: '9007199254740998' },
    { ...context, lastOffset: '9223372036854775808' },
    { ...context, firstOffset: 12 },
    { ...context, firstOffset: 'x'.repeat(100) },
  ])('drops invalid context while preserving the error observation', (input) => {
    const state = new BidProcessingStateService();
    state.recordError('BID_PROCESSING_FAILED', input as typeof context);
    expect(state.snapshot().lastError).toMatchObject({ code: 'BID_PROCESSING_FAILED', context: null });
  });
  it('keeps the inclusive maximum offset and partition without rounding', () => {
    const state = new BidProcessingStateService();
    state.recordError('DLQ_PUBLICATION_FAILED', {
      ...context,
      partition: 2147483647,
      lastOffset: '9223372036854775807',
    });
    expect(state.snapshot().lastError?.context?.lastOffset).toBe('9223372036854775807');
  });
});
