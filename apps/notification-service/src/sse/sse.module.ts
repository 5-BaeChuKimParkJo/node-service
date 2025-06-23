import { Module } from '@nestjs/common';
import { SseController } from './sse.controller';
import { SseService } from './sse.service';
import { RedisModule } from '@app/common/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [SseController],
  providers: [SseService],
})
export class SseModule {}
