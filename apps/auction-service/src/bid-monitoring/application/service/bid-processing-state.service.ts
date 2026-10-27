import { Injectable } from '@nestjs/common';
import type { BidErrorCode, BidFailureContext, BidProcessingHistory } from '../model/bid-processing-status.result';

function copyContext(context?: BidFailureContext): BidFailureContext | null {
  try {
    const offset = (value: unknown): value is string =>
      typeof value === 'string' && /^(?:0|[1-9]\d{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n;
    if (
      !context ||
      context.topic !== 'auction-service.bidder.created' ||
      !Number.isInteger(context.partition) ||
      context.partition < 0 ||
      context.partition > 2147483647 ||
      !offset(context.firstOffset) ||
      !offset(context.lastOffset) ||
      BigInt(context.firstOffset) > BigInt(context.lastOffset)
    )
      return null;
    return {
      topic: context.topic,
      partition: context.partition,
      firstOffset: context.firstOffset,
      lastOffset: context.lastOffset,
    };
  } catch {
    return null;
  }
}

@Injectable()
export class BidProcessingStateService {
  private readonly startedAt = new Date().toISOString();
  private lastAcknowledgedAt: string | null = null;
  private lastError: BidProcessingHistory['lastError'] = null;

  recordAcknowledgement(): void {
    this.lastAcknowledgedAt = new Date().toISOString();
  }
  recordError(code: BidErrorCode, context?: BidFailureContext): void {
    this.lastError = { code, occurredAt: new Date().toISOString(), context: copyContext(context) };
  }
  snapshot(): BidProcessingHistory {
    return {
      startedAt: this.startedAt,
      lastAcknowledgedAt: this.lastAcknowledgedAt,
      lastError: this.lastError
        ? { ...this.lastError, context: this.lastError.context ? { ...this.lastError.context } : null }
        : null,
    };
  }
}
