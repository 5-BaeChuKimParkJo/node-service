import { AppException } from '@app/common/common/app.exception';
import { ErrorCode } from '@app/common/common/const';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AuctionAdminMapper } from '../mapper/auction-admin.mapper';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { AuctionsAdminCommand } from '../model/auctions-admin.command';
import { AuctionsAdminResult } from '../model/auctions-admin.result';
import { AuctionAdminDetailResult } from '../model/auction-admin.result';
import { AuctionAdminAction } from '../../domain/model/admin-auction';
import { AuctionAdminBidsCommand } from '../model/auction-admin-bids.command';
import { AuctionAdminBidsResult } from '../model/auction-admin-bids.result';

export type AuctionAdminActionCommand = {
  auctionUuid: string;
  action: AuctionAdminAction;
  actor: string;
  reason: string;
  now?: Date;
};

@Injectable()
export class AuctionAdminService {
  constructor(
    private readonly auctionRepositoryPort: AuctionRepositoryPort,
    private readonly auctionAdminMapper: AuctionAdminMapper,
  ) {}

  async list(command: AuctionsAdminCommand): Promise<AuctionsAdminResult> {
    const result = await this.auctionRepositoryPort.findAuctions(command);
    return {
      items: result.items.map((item) => this.auctionAdminMapper.toResponse(item)),
      nextCursor: result.nextCursor
        ? { ...result.nextCursor, createdAt: result.nextCursor.createdAt.toISOString() }
        : null,
    };
  }

  async get(auctionUuid: string): Promise<AuctionAdminDetailResult> {
    const result = await this.auctionRepositoryPort.findAuction({ type: 'admin', auctionUuid });
    const auditLogs = await this.findAuditLogs(auctionUuid);
    return { ...this.auctionAdminMapper.toResponse(result), auditLogs };
  }

  async bids(command: AuctionAdminBidsCommand): Promise<AuctionAdminBidsResult> {
    const result = await this.auctionRepositoryPort.findAdminBids(command);
    return this.auctionAdminMapper.toBidsResponse(result);
  }

  async action(command: AuctionAdminActionCommand): Promise<AuctionAdminDetailResult> {
    const reason = command.reason.trim();
    if (!reason) {
      throw new AppException(
        { message: '관리자 조치 사유를 입력해 주세요.', code: ErrorCode.VALIDATION_ERROR },
        HttpStatus.BAD_REQUEST,
      );
    }
    const result = await this.auctionRepositoryPort.applyAdminAction({ ...command, reason });
    const auditLogs = await this.findAuditLogs(command.auctionUuid);
    return { ...this.auctionAdminMapper.toResponse(result), auditLogs };
  }

  private async findAuditLogs(auctionUuid: string) {
    const auditLogs = await this.auctionRepositoryPort.findAdminActions(auctionUuid);
    return auditLogs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() }));
  }
}
