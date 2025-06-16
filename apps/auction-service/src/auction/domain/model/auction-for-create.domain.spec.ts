import { User } from '@app/common';
import AuctionForCreateDomain, { AuctionForCreateArgs } from './auction-for-create.domain';
import { add, set } from 'date-fns';

describe('auction-for-create.domain', () => {
  it('경매 시작일과 종료일 사이의 시간 차이가 딱 1시간인 경우 예외 발생하지 않음', () => {
    const dummyArgs: Omit<AuctionForCreateArgs, 'startAt' | 'endAt'> = {
      description: 'description',
      images: [
        {
          key: 'auction/d84c1c39-1b5e-41b6-810d-9c8edff5f0f7/images/7f59301b-52ad-4c1e-82a4-4e88c71fe287.png',
          order: 0,
        },
      ],
      minimumBid: 1000n,
      productCondition: 'new',
      isDirectDeal: false,
      thumbnailKey: 'auction/d84c1c39-1b5e-41b6-810d-9c8edff5f0f7/images/7f59301b-52ad-4c1e-82a4-4e88c71fe287.png',
      title: 'title',
      categoryId: 1,
      directDealLocation: 'test',
    };
    const dummyUser: User = {
      role: 'user',
      memberUuid: 'd84c1c39-1b5e-41b6-810d-9c8edff5f0f7',
    };
    const startAt = set(add(new Date(), { years: 1 }), { minutes: 0, seconds: 0, milliseconds: 0 });

    expect(
      () =>
        new AuctionForCreateDomain(
          {
            startAt,
            endAt: add(startAt, { hours: 1 }),
            ...dummyArgs,
          },
          dummyUser,
        ),
    ).not.toThrow();

    expect(
      () =>
        new AuctionForCreateDomain(
          {
            startAt,
            endAt: new Date(startAt.getTime() + 60 * 60 * 1000 - 1),
            ...dummyArgs,
          },
          dummyUser,
        ),
    ).toThrow();
  });
});
