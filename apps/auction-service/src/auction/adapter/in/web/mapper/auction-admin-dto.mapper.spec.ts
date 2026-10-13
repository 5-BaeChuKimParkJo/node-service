import { AuctionAdminDtoMapper } from './auction-admin-dto.mapper';

describe('AuctionAdminDtoMapper', () => {
  it('maps trimmed search, status, and a complete cursor', () => {
    expect(
      AuctionAdminDtoMapper.toListCommand({
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
    expect(() => AuctionAdminDtoMapper.toListCommand({ createdAt: '2026-10-13T02:00:00.000Z' })).toThrow();
    expect(() => AuctionAdminDtoMapper.toActionCommand(
      '10000000-0000-0000-0000-000000000000',
      'operator',
      { action: 'delete' as never, reason: '잘못된 요청' },
    )).toThrow();
  });
});
