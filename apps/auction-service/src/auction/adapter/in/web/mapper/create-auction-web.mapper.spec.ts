import { CreateAuctionWebMapper } from './create-auction-web.mapper';
import { CreateAuctionRequest } from '../dto/create-auction.dto';

describe('CreateAuctionWebMapper provenance boundary', () => {
  it('does not accept private demo provenance from a public creation request', () => {
    const input = {
      title: 'Ordinary camera',
      description: 'Camera fixture',
      minimumBid: 1000,
      startAt: '2026-10-25T01:00:00Z',
      endAt: '2026-10-26T01:00:00Z',
      isDirectDeal: false,
      directDealLocation: null,
      productCondition: 'used',
      thumbnailKey: 'fixture.webp',
      categoryId: 1,
      tagIds: [],
      images: [{ key: 'fixture.webp', order: 0 }],
      demoTemplateUuid: '10000000-0000-4000-8000-000000000001',
      mode: 'automatic',
    };
    const command = CreateAuctionWebMapper.toCommand(input as CreateAuctionRequest);
    expect(command).not.toHaveProperty('demoTemplateUuid');
    expect(command).not.toHaveProperty('mode');
    expect(command.minimumBid).toBe(1000n);
    expect(command.startAt).toEqual(new Date('2026-10-25T01:00:00Z'));
  });
});
