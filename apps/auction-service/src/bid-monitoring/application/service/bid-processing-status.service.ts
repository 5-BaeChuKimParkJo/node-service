import { Injectable } from '@nestjs/common';
import { BidBrokerPort } from '../port/out/bid-broker.port';
import { BidProcessingStateService } from './bid-processing-state.service';
import type { BidProcessingStatusResult } from '../model/bid-processing-status.result';

type BrokerResult = Omit<BidProcessingStatusResult, 'startedAt' | 'lastAcknowledgedAt' | 'lastError'>;

@Injectable()
export class BidProcessingStatusService {
  private cached?: { value: BrokerResult; expiresAt: number };
  private pending?: Promise<BrokerResult>;

  constructor(
    private readonly broker: BidBrokerPort,
    private readonly state: BidProcessingStateService,
  ) {}

  async get(): Promise<BidProcessingStatusResult> {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return { ...this.cached.value, ...this.state.snapshot() };
    }
    this.pending ??= this.read()
      .then((value) => {
        this.cached = { value, expiresAt: Date.now() + 5000 };
        return value;
      })
      .finally(() => {
        this.pending = undefined;
      });
    return { ...(await this.pending), ...this.state.snapshot() };
  }

  private async read(): Promise<BrokerResult> {
    try {
      const value = await this.broker.snapshot();
      return { asOf: new Date().toISOString(), broker: 'available', ...value };
    } catch {
      return {
        asOf: new Date().toISOString(),
        broker: 'unavailable',
        groupState: null,
        lag: null,
        dlqRetained: null,
        retentionGap: null,
      };
    }
  }
}
