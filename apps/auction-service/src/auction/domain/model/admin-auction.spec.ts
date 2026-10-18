import { BusinessError } from '@app/common/common/business-error';
import AdminAuction, { AuctionAdminArgs } from './admin-auction';

const NOW = new Date('2026-10-13T02:34:56.000Z');

const auction = (overrides: Partial<AuctionAdminArgs> = {}) =>
  new AdminAuction({
    auctionId: 1n,
    auctionUuid: '10000000-0000-0000-0000-000000000000',
    categoryId: 1,
    title: '관리자 경매 테스트',
    description: '관리자 상태 변경 규칙을 검증합니다.',
    minimumBid: 1000n,
    currentBid: 1500n,
    currentBidderUuid: '20000000-0000-0000-0000-000000000000',
    startAt: new Date('2026-10-13T02:00:00.000Z'),
    endAt: new Date('2026-10-13T05:00:00.000Z'),
    soldAt: null,
    isDirectDeal: false,
    directDealLocation: null,
    status: 'visible',
    productCondition: 'used',
    viewCount: 10n,
    thumbnailKey: 'auction/thumbnail.jpg',
    createdAt: new Date('2026-10-12T01:00:00.000Z'),
    updatedAt: new Date('2026-10-12T01:00:00.000Z'),
    deletedAt: null,
    sellerUuid: '30000000-0000-0000-0000-000000000000',
    version: 0,
    tagIds: [],
    images: [],
    ...overrides,
  });

describe('AuctionAdminDomain', () => {
  it('hides an active auction', () => {
    const result = auction().planAction('hide', NOW);

    expect(result).toEqual({
      previousStatus: 'active',
      nextStatus: 'hidden',
      persistedStatus: 'hidden',
      endAt: new Date('2026-10-13T05:00:00.000Z'),
    });
  });

  it('restores a hidden auction to its time-derived state', () => {
    const result = auction({ status: 'hidden' }).planAction('restore', NOW);

    expect(result.previousStatus).toBe('hidden');
    expect(result.nextStatus).toBe('active');
    expect(result.persistedStatus).toBe('visible');
  });

  it('force-ends an auction at the current UTC hour', () => {
    const result = auction().planAction('force-end', NOW);

    expect(result.nextStatus).toBe('ended');
    expect(result.persistedStatus).toBe('visible');
    expect(result.endAt).toEqual(new Date('2026-10-13T02:00:00.000Z'));
  });

  it('rejects an action for an already ended auction', () => {
    const ended = auction({ endAt: new Date('2026-10-13T01:00:00.000Z') });

    expect(() => ended.planAction('hide', NOW)).toThrowError(BusinessError);
    try {
      ended.planAction('hide', NOW);
    } catch (error) {
      expect((error as BusinessError).category).toBe('conflict');
    }
  });
});
