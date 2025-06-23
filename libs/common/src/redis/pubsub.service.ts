import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class PubSubService implements OnModuleDestroy {
  private handlers = new Map<string, (channel: string, message: string) => void>();

  constructor(
    @Inject('REDIS_PUB_CLIENT') private readonly redisPub: Redis,
    @Inject('REDIS_SUB_CLIENT') private readonly redisSub: Redis,
  ) {}

  subscribe = async (channel: string, handler: (channel: string, message: string) => void) => {
    if (this.handlers.size === 0) {
      this.redisSub.on('message', (ch, message) => {
        const handler = this.handlers.get(ch);
        if (handler) handler(ch, message);
      });
    }
    this.handlers.set(channel, handler);
    await this.redisSub.subscribe(channel);
  };

  publish = async (channel: string, message: string) => {
    await this.redisPub.publish(channel, message);
  };

  onModuleDestroy = async () => {
    await this.redisPub.quit();
    await this.redisSub.quit();
  };
}
