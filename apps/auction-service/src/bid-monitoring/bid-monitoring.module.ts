import { Module } from '@nestjs/common';
import { BidBrokerPort } from './application/port/out/bid-broker.port';
import { KafkaBidBrokerAdapter } from './adapter/out/kafka/kafka-bid-broker.adapter';
import { BidProcessingStateService } from './application/service/bid-processing-state.service';
import { BidProcessingStatusService } from './application/service/bid-processing-status.service';
import { BidProcessingStatusController } from './adapter/in/web/bid-processing-status.controller';
import { InternalAdminTokenGuard } from '../auction/adapter/in/web/internal-admin-token.guard';

@Module({
  controllers: [BidProcessingStatusController],
  providers: [
    BidProcessingStateService,
    BidProcessingStatusService,
    InternalAdminTokenGuard,
    { provide: BidBrokerPort, useClass: KafkaBidBrokerAdapter },
  ],
  exports: [BidProcessingStateService],
})
export class BidMonitoringModule {}
