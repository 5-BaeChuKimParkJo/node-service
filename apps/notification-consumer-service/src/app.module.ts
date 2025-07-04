import { Module } from '@nestjs/common';
import { SyncModule } from './sync/sync.module';
import { HealthModule } from './health/health.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [SyncModule, HealthModule, NotificationModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
