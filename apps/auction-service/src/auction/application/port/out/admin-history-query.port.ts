import { AdminHistoryCommand } from '../../model/admin-history.command';
import { AdminHistoryItem } from '../../model/admin-history.result';

export type AdminHistoryRecord = Omit<AdminHistoryItem, 'amount'> & { amount: bigint | null };

export abstract class AdminHistoryQueryPort {
  abstract find(command: AdminHistoryCommand): Promise<AdminHistoryRecord[]>;
}
