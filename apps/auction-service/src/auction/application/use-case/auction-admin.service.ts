import { AppException, ErrorCode } from '@app/common';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AuctionAdminMapper } from '../mapper/auction-admin.mapper';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { AuctionsAdminCommand } from '../port/dto/auctions-admin.command';
import { AuctionsAdminResponse } from '../port/dto/auctions-admin.response';
import { AuctionAdminDetailResponse } from '../port/dto/auction-admin.response';
import { AuctionAdminAction } from '../../domain/model/auction-admin.domain';
import { AuctionAdminBidsCommand } from '../port/dto/auction-admin-bids.command';
import { AuctionAdminBidsResponse } from '../port/dto/auction-admin-bids.response';

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

  async list(command: AuctionsAdminCommand): Promise<AuctionsAdminResponse> {
    const result = await this.auctionRepositoryPort.findAuctions(command);
    return {
      items: result.items.map((item) => this.auctionAdminMapper.toResponse(item)),
      nextCursor: result.nextCursor
        ? { ...result.nextCursor, createdAt: result.nextCursor.createdAt.toISOString() }
        : null,
    };
  }

  async get(auctionUuid: string): Promise<AuctionAdminDetailResponse> {
    const result = await this.auctionRepositoryPort.findAuction({ type: 'admin', auctionUuid });
    const auditLogs = await this.findAuditLogs(auctionUuid);
    return { ...this.auctionAdminMapper.toResponse(result), auditLogs };
  }

  async bids(command: AuctionAdminBidsCommand): Promise<AuctionAdminBidsResponse> {
    const result = await this.auctionRepositoryPort.findAdminBids(command);
    return this.auctionAdminMapper.toBidsResponse(result);
  }

  async action(command: AuctionAdminActionCommand): Promise<AuctionAdminDetailResponse> {
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
