import { parseSellerAuctionChange, sellerAuctionEditable, sellerAuctionStatus } from './seller-auction-policy';

const now = new Date('2026-10-31T01:30:00Z');
const waiting = () => ({
  status: 'visible',
  deletedAt: null,
  soldAt: null,
  checkoutLockedAt: null,
  startAt: new Date('2026-10-31T02:00:00Z'),
  endAt: new Date('2026-11-01T02:00:00Z'),
  currentBid: 0n,
  currentBidderUuid: null,
  bidCount: 0,
  hasPurchase: false,
});
const update = () => ({
  version: 3,
  title: '수정한 경매 제목',
  description: '설명',
  minimumBid: '1500',
  startAt: '2026-11-01T11:00:00+09:00',
  endAt: '2026-11-02T02:00:00Z',
});

describe('waiting seller auction policy', () => {
  it('accepts only the five editable fields and preserves decimal money and zoned hours', () => {
    expect(parseSellerAuctionChange(update(), 'update')).toEqual({
      ...update(),
      action: 'update',
      startAt: new Date('2026-11-01T02:00:00Z'),
      endAt: new Date('2026-11-02T02:00:00Z'),
    });
    expect(parseSellerAuctionChange({ ...update(), minimumBid: '2147483647' }, 'update').minimumBid).toBe('2147483647');
  });
  it.each([
    { sellerUuid: 'other' },
    { status: 'visible' },
    { images: [] },
    { soldAt: null },
    { version: -1 },
    { version: 1.5 },
    { title: '짧음' },
    { title: 'a'.repeat(101) },
    { description: 'a'.repeat(1001) },
    { minimumBid: 1000 },
    { minimumBid: '999' },
    { minimumBid: '1e4' },
    { minimumBid: '01000' },
    { minimumBid: '9007199254740992' },
    { minimumBid: '2147483648' },
    { startAt: '2026-11-01T11:00' },
    { startAt: '2026-11-01T02:01:00Z' },
    { endAt: '2026-11-01T02:00:00Z' },
  ])('rejects invalid or injected update fields %j', (patch) => {
    expect(() => parseSellerAuctionChange({ ...update(), ...patch }, 'update')).toThrow();
  });
  it('requires a structured cancel reason and detail only for other', () => {
    expect(
      parseSellerAuctionChange({ version: 3, reasonCode: 'other', reasonDetail: '  설명 오류  ' }, 'cancel'),
    ).toEqual({ action: 'cancel', version: 3, reasonCode: 'other', reasonDetail: '설명 오류' });
    expect(parseSellerAuctionChange({ version: 3, reasonCode: 'listing_error' }, 'cancel')).toEqual({
      action: 'cancel',
      version: 3,
      reasonCode: 'listing_error',
    });
    for (const value of [
      { version: 3, reasonCode: 'other' },
      { version: 3, reasonCode: 'other', reasonDetail: '  ' },
      { version: 3, reasonCode: 'other', reasonDetail: 'x'.repeat(201) },
      { version: 3, reasonCode: 'unknown' },
      { version: 3, reasonCode: 'listing_error', reasonDetail: 'custom' },
      { version: 3, reasonCode: 'other', reasonDetail: 'x', sellerUuid: 'x' },
    ]) {
      expect(() => parseSellerAuctionChange(value, 'cancel')).toThrow();
    }
  });
  it('allows visible waiting auctions only and closes exactly at start', () => {
    expect(sellerAuctionEditable(waiting(), now)).toBe(true);
    expect(sellerAuctionEditable(waiting(), new Date('2026-10-31T02:00:00Z'))).toBe(false);
    expect(sellerAuctionStatus(waiting(), now)).toBe('waiting');
    expect(sellerAuctionStatus(waiting(), new Date('2026-10-31T02:00:00Z'))).toBe('active');
    expect(sellerAuctionStatus(waiting(), new Date('2026-11-01T02:00:00Z'))).toBe('ended');
  });
  it.each([
    { status: 'hidden' },
    { status: 'cancelled' },
    { deletedAt: now },
    { soldAt: now },
    { checkoutLockedAt: now },
    { bidCount: 1 },
    { currentBid: 1n },
    { currentBidderUuid: 'bidder' },
    { hasPurchase: true },
  ])('blocks protected auction state %#', (patch) => {
    expect(sellerAuctionEditable({ ...waiting(), ...patch }, now)).toBe(false);
  });
});
