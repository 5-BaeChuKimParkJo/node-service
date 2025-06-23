import { Module } from '@nestjs/common';
import { SyncModule } from './sync/sync.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [SyncModule, HealthModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
