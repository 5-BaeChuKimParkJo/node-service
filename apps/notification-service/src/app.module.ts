import { Module } from '@nestjs/common';
import { SseModule } from './sse/sse.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [SseModule, HealthModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
