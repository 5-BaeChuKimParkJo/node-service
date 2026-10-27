export type BidErrorCode = 'BID_PROCESSING_FAILED' | 'DLQ_PUBLICATION_FAILED' | 'OFFSET_COMMIT_FAILED';
export type BidProcessingHistory = {
  startedAt: string;
  lastAcknowledgedAt: string | null;
  lastError: { code: BidErrorCode; occurredAt: string } | null;
};
export type BidBrokerSnapshot = {
  groupState: string;
  lag: string;
  dlqRetained: string;
  retentionGap: boolean;
};
export type BidProcessingStatusResult = BidProcessingHistory & {
  asOf: string;
  broker: 'available' | 'unavailable';
  groupState: string | null;
  lag: string | null;
  dlqRetained: string | null;
  retentionGap: boolean | null;
};
