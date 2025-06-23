import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { PubSubService } from './pubsub.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnvSchema } from '../common/env-schema';
import { RedisService } from './redis.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_PUB_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvSchema>) => {
        return new Redis({
          host: configService.get('REDIS_HOST'),
          port: Number(configService.get('REDIS_PORT')),
          password: configService.get('REDIS_PASSWORD'),
        });
      },
    },
    {
      provide: 'REDIS_SUB_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvSchema>) => {
        return new Redis({
          host: configService.get('REDIS_HOST'),
          port: Number(configService.get('REDIS_PORT')),
          password: configService.get('REDIS_PASSWORD'),
        });
      },
    },
    PubSubService,
    RedisService,
  ],
  exports: [PubSubService, RedisService],
})
export class RedisModule {}
