import * as E from 'fp-ts/Either';
import { AuctionEtcService } from './auction-etc.service';

describe('AuctionEtcService getMyBids', () => {
  it('assembles bid history from the auction database and member service', async () => {
    const createdAt = new Date('2026-10-02T12:00:00.000Z');
    const repository = {
      findMyBidDetails: vi.fn().mockReturnValue(() =>
        Promise.resolve(
          E.right([
            {
              bidderUuid: '20000000-0000-0000-0000-000000000000',
              bidAmount: 11_000n,
              createdAt,
              auction: {
                auctionUuid: '10000000-0000-0000-0000-000000000000',
                categoryId: 1,
                title: 'test auction',
                description: 'description',
                minimumBid: 10_000n,
                currentBid: 11_000n,
                startAt: new Date('2026-10-02T11:00:00.000Z'),
                endAt: new Date('2026-10-03T11:00:00.000Z'),
                isDirectDeal: false,
                directDealLocation: null,
                status: 'visible',
                productCondition: 'used',
                viewCount: 3n,
                thumbnailKey: 'thumb.webp',
                soldAt: null,
                createdAt,
                version: 2,
                sellerUuid: '30000000-0000-0000-0000-000000000000',
                tagIds: [4],
                auctionImages: [{ auctionImageId: 1n, key: 'image.webp', order: 0 }],
              },
            },
          ]),
        ),
      ),
    };
    const fn = {
      fetchMembers: vi.fn().mockReturnValue(() =>
        Promise.resolve(
          E.right([
            {
              memberUuid: '30000000-0000-0000-0000-000000000000',
              nickname: 'seller',
              gradeUuid: '40000000-0000-0000-0000-000000000000',
              honor: null,
              state: 'ACTIVE',
              profileImageUrl: null,
              point: 100,
            },
          ]),
        ),
      ),
    };
    const taxonomy = {
      listCategories: vi
        .fn()
        .mockResolvedValue([{ categoryId: 1, name: 'digital', description: 'digital items', imageUrl: null }]),
      listTags: vi.fn().mockResolvedValue([{ tagId: 4, name: 'delivery' }]),
    };
    const storage = { toFullUrl: vi.fn((key: string) => `/images/${key}`) };
    const service = new AuctionEtcService(
      { $transaction: vi.fn() } as never,
      repository as never,
      fn as never,
      taxonomy as never,
      storage as never,
    );

    const result = await service.getMyBids({ memberUuid: '20000000-0000-0000-0000-000000000000' } as never)();

    expect(E.isRight(result)).toBe(true);
    if (E.isLeft(result)) return;
    expect(result.right[0].auction).toMatchObject({
      auctionUuid: '10000000-0000-0000-0000-000000000000',
      currentBid: 11_000,
      category: { categoryId: 1, name: 'digital' },
      tags: [{ tagId: 4, name: 'delivery' }],
      seller: { nickname: 'seller' },
      thumbnailUrl: '/images/thumb.webp',
    });
  });
});
