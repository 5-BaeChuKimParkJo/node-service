import { AuctionAdminWebMapper } from './auction-admin-web.mapper';

describe('AuctionAdminDtoMapper', () => {
  it('validates the ending-soon option without truthy coercion', () => {
    expect(AuctionAdminWebMapper.toListCommand({ endingSoon: 'true' }).endingSoon).toBe(true);
    expect(AuctionAdminWebMapper.toListCommand({ endingSoon: 'false' }).endingSoon).toBe(false);
    for (const endingSoon of ['', '1', 'yes', ['true', 'false']]) {
      expect(() => AuctionAdminWebMapper.toListCommand({ endingSoon: endingSoon as string })).toThrow();
    }
  });
  it('maps trimmed search, status, and a complete cursor', () => {
    expect(
      AuctionAdminWebMapper.toListCommand({
        query: '  카메라  ',
        status: 'active',
        createdAt: '2026-10-13T02:00:00.000Z',
        auctionUuid: '10000000-0000-0000-0000-000000000000',
      }),
    ).toEqual({
      type: 'admin',
      query: '카메라',
      status: 'active',
      cursor: {
        createdAt: new Date('2026-10-13T02:00:00.000Z'),
        auctionUuid: '10000000-0000-0000-0000-000000000000',
      },
    });
  });

  it('rejects partial cursors and invalid actions', () => {
    expect(() => AuctionAdminWebMapper.toListCommand({ createdAt: '2026-10-13T02:00:00.000Z' })).toThrow();
    expect(() =>
      AuctionAdminWebMapper.toActionCommand('10000000-0000-0000-0000-000000000000', 'operator', {
        action: 'delete' as never,
        reason: '잘못된 요청',
      }),
    ).toThrow();
  });
});
