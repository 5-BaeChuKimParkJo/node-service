import { Module } from '@nestjs/common';
import { SyncModule } from './sync/sync.module';
import { ConfigModule } from '@nestjs/config';
import { envValidate } from './common/env-schema';
import { ReadModule } from './read/read.module';
import { HealthModule } from './health/health.module';
import { MongoModule } from './mongo/mongo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: envValidate,
    }),
    HealthModule,
    SyncModule,
    ReadModule,
    MongoModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
