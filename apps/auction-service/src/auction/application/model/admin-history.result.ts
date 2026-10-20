import { AdminHistoryAction, AdminHistoryCursor } from './admin-history.command';

export type AdminHistoryItem = {
  entryKey: string;
  occurredAt: string;
  auctionUuid: string;
  auctionTitle: string | null;
  actor: string | null;
  action: AdminHistoryAction;
  reason: string | null;
  status: 'SUCCEEDED' | 'PENDING' | 'REVIEW_REQUIRED';
  previousStatus: string | null;
  nextStatus: string | null;
  amount: string | null;
};
export type AdminHistoryResult = { items: AdminHistoryItem[]; nextCursor: AdminHistoryCursor | null };
