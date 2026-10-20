export type AdminHistoryAction = 'hide' | 'restore' | 'force-end' | 'payment-cancel';
export type AdminHistoryCursor = { occurredAt: string; entryKey: string };
export type AdminHistoryCommand = {
  action?: AdminHistoryAction;
  auctionUuid?: string;
  from?: string;
  to?: string;
  cursor?: AdminHistoryCursor;
};
