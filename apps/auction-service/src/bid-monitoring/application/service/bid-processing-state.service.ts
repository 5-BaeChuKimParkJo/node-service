import { Injectable } from '@nestjs/common';
import type { BidErrorCode, BidProcessingHistory } from '../model/bid-processing-status.result';

@Injectable()
export class BidProcessingStateService {
  private readonly startedAt = new Date().toISOString();
  private lastAcknowledgedAt: string | null = null;
  private lastError: BidProcessingHistory['lastError'] = null;

  recordAcknowledgement(): void {
    this.lastAcknowledgedAt = new Date().toISOString();
  }
  recordError(code: BidErrorCode): void {
    this.lastError = { code, occurredAt: new Date().toISOString() };
  }
  snapshot(): BidProcessingHistory {
    return {
      startedAt: this.startedAt,
      lastAcknowledgedAt: this.lastAcknowledgedAt,
      lastError: this.lastError ? { ...this.lastError } : null,
    };
  }
}
