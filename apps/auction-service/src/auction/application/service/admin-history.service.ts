import { Injectable } from '@nestjs/common';
import { AdminHistoryCommand } from '../model/admin-history.command';
import { AdminHistoryResult } from '../model/admin-history.result';
import { AdminHistoryQueryPort } from '../port/out/admin-history-query.port';

@Injectable()
export class AdminHistoryService {
  constructor(private readonly history: AdminHistoryQueryPort) {}

  async list(command: AdminHistoryCommand): Promise<AdminHistoryResult> {
    const rows = await this.history.find(command);
    const items = rows.slice(0, 20).map((row) => ({
      entryKey: row.entryKey,
      occurredAt: row.occurredAt,
      auctionUuid: row.auctionUuid,
      auctionTitle: row.auctionTitle,
      actor: row.actor,
      action: row.action,
      reason: row.reason,
      status: row.status,
      previousStatus: row.previousStatus,
      nextStatus: row.nextStatus,
      amount: row.amount === null ? null : row.amount.toString(),
    }));
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > 20 && last ? { occurredAt: last.occurredAt, entryKey: last.entryKey } : null,
    };
  }
}
