import { Module } from '@nestjs/common';
import { AuctionEtcController } from './auction-etc.controller';
import { AuctionEtcService } from './auction-etc.service';
import { AuctionEtcFn } from './auction-etc.fn';
import { AuctionEtcRepository } from './auction-etc.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { KafkaService } from '@app/common/kafka/kafka.service';
import { AuctionServiceBidderCreatedConsumer } from './auction-service-bidder-created.consumer';

@Module({
  imports: [PrismaModule],
  controllers: [AuctionEtcController],
  providers: [AuctionEtcService, AuctionEtcFn, AuctionEtcRepository, KafkaService, AuctionServiceBidderCreatedConsumer],
})
export class AuctionEtcModule {}
