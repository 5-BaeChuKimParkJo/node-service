import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvSchema } from '../common/env-schema';

@Injectable()
export class RedisService extends Redis {
  constructor(private readonly configService: ConfigService<EnvSchema>) {
    super({
      host: configService.get('REDIS_HOST'),
      port: Number(configService.get('REDIS_PORT')),
      password: configService.get('REDIS_PASSWORD'),
    });
  }
}
