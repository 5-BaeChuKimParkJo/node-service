import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { AuctionAdminMapper } from '../mapper/auction-admin.mapper';
import { AuctionAdminService } from './auction-admin.service';

describe('AuctionAdminService', () => {
  it('applies an action with the authenticated actor and trimmed reason', async () => {
    const updated = { auctionUuid: '10000000-0000-0000-0000-000000000000' };
    const response = { auctionUuid: updated.auctionUuid, status: 'hidden' };
    const repository = {
      applyAdminAction: vi.fn().mockResolvedValue(updated),
      findAdminActions: vi.fn().mockResolvedValue([{ action: 'hide', createdAt: new Date('2026-10-13T02:34:56.000Z') }]),
    } as unknown as AuctionRepositoryPort;
    const mapper = {
      toResponse: vi.fn().mockReturnValue(response),
    } as unknown as AuctionAdminMapper;
    const service = new AuctionAdminService(repository, mapper);
    const now = new Date('2026-10-13T02:34:56.000Z');

    await expect(
      service.action({
        auctionUuid: updated.auctionUuid,
        action: 'hide',
        actor: 'operator',
        reason: '  신고 검토 중  ',
        now,
      }),
    ).resolves.toEqual({ ...response, auditLogs: [{ action: 'hide', createdAt: '2026-10-13T02:34:56.000Z' }] });

    expect(repository.applyAdminAction).toHaveBeenCalledWith({
      auctionUuid: updated.auctionUuid,
      action: 'hide',
      actor: 'operator',
      reason: '신고 검토 중',
      now,
    });
    expect(repository.findAdminActions).toHaveBeenCalledWith(updated.auctionUuid);
  });

  it('rejects an empty action reason before touching the repository', async () => {
    const repository = {
      applyAdminAction: vi.fn(),
    } as unknown as AuctionRepositoryPort;
    const service = new AuctionAdminService(repository, {} as AuctionAdminMapper);

    await expect(
      service.action({
        auctionUuid: '10000000-0000-0000-0000-000000000000',
        action: 'hide',
        actor: 'operator',
        reason: '   ',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.applyAdminAction).not.toHaveBeenCalled();
  });
});
