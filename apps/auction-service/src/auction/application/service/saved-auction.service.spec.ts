import { SavedAuctionService } from './saved-auction.service';
import type { SavedAuctionRepositoryPort } from '../port/out/saved-auction-repository.port';

describe('saved auction display status', () => {
  it.each([
    ['2026-10-29T08:59:59Z', 'waiting'],
    ['2026-10-29T09:00:00Z', 'active'],
    ['2026-10-29T10:00:00Z', 'ended'],
  ])('classifies server time %s as %s without a winner claim', async (time, status) => {
    const service = new SavedAuctionService({
      list: async () => ({
        items: [
          {
            auctionUuid: 'fixture',
            title: 'Saved fixture',
            thumbnailUrl: '/fixture.png',
            minimumBid: '1000',
            currentBid: '2000',
            startAt: new Date('2026-10-29T09:00:00Z'),
            endAt: new Date('2026-10-29T10:00:00Z'),
            savedAt: new Date('2026-10-28T00:00:00Z'),
          },
        ],
        nextCursor: null,
      }),
    } as SavedAuctionRepositoryPort);
    expect((await service.list('member', null, new Date(time))).items[0].status).toBe(status);
  });
});
