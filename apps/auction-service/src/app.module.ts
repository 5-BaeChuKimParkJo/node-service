import { Module } from '@nestjs/common';
import { TestModule } from './test/test.module';
import { ConfigModule } from '@nestjs/config';
import { envValidate } from './common/env-schema';
import { PrismaModule } from './prisma/prisma.module';
import { AuctionModule } from './auction/auction.module';
import { HealthModule } from './health/health.module';
import { BatchModule } from './batch/batch.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuctionEtcModule } from './auction-etc/auction-etc.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: envValidate,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    TestModule,
    AuctionModule,
    HealthModule,
    BatchModule,
    AuctionEtcModule,
  ],
})
export class AppModule {}
