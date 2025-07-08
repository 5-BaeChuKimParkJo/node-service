import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from './generated';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: [
        // { emit: 'event', level: 'query' },
        // { emit: 'stdout', level: 'error' },
        // { emit: 'stdout', level: 'info' },
        // { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();

    // @ts-ignore
    // this.$on('query', (e) => {
    //   // @ts-ignore
    //   console.log('[PRISMA QUERY]', e.query, e.params);
    // });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
