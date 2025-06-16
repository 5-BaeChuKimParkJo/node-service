import { Module } from '@nestjs/common';
import { SyncModule } from './sync/sync.module';
import { ConfigModule } from '@nestjs/config';
import { envValidate } from './common/env-schema';
import { ReadModule } from './read/read.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: envValidate,
    }),
    HealthModule,
    SyncModule,
    ReadModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
