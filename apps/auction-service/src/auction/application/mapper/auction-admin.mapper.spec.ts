import AdminAuction from '../../domain/model/admin-auction';
import { AuctionAdminMapper } from './auction-admin.mapper';

it('serializes monetary bigint values as exact decimal strings', () => {
  const mapper = new AuctionAdminMapper({ toFullUrl: (key: string) => `http://minio/${key}` } as never);
  const auction = new AdminAuction({
    auctionId: 1n,
    auctionUuid: '10000000-0000-0000-0000-000000000000',
    categoryId: 1,
    title: '정밀 금액 경매',
    description: '자바스크립트 안전 정수보다 큰 금액을 검증합니다.',
    minimumBid: 9007199254740993n,
    currentBid: 9007199254740995n,
    currentBidderUuid: null,
    startAt: new Date('2026-10-13T02:00:00.000Z'),
    endAt: new Date('2026-10-13T05:00:00.000Z'),
    soldAt: null,
    isDirectDeal: false,
    directDealLocation: null,
    status: 'visible',
    productCondition: 'used',
    viewCount: 1n,
    thumbnailKey: 'thumbnail.jpg',
    createdAt: new Date('2026-10-12T01:00:00.000Z'),
    updatedAt: new Date('2026-10-12T01:00:00.000Z'),
    deletedAt: null,
    sellerUuid: '30000000-0000-0000-0000-000000000000',
    version: 0,
    tagIds: [],
    images: [],
  });

  const response = mapper.toResponse(auction);

  expect(response.minimumBid).toBe('9007199254740993');
  expect(response.currentBid).toBe('9007199254740995');
  expect(response).toMatchObject({
    visibility: 'visible',
    updatedAt: '2026-10-12T01:00:00.000Z',
    deletedAt: null,
    version: 0,
  });

  const deleted = new AdminAuction({
    ...auction.getSnapshot(),
    status: 'hidden',
    deletedAt: new Date('2026-10-14T01:00:00.000Z'),
    version: 7,
  });
  expect(mapper.toResponse(deleted)).toMatchObject({
    status: 'hidden',
    visibility: 'hidden',
    deletedAt: '2026-10-14T01:00:00.000Z',
    version: 7,
  });
});
