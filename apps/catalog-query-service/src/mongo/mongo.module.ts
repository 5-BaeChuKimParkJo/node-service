import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongoClient } from 'mongodb';
import { EnvSchema } from '../common/env-schema';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'MONGO_DB',
      inject: [ConfigService],
      useFactory: async (configService: ConfigService<EnvSchema>) => {
        const url = new URL(configService.getOrThrow('MONGO_URL'));
        url.pathname = 'catalog-query-service';
        const client = await MongoClient.connect(url.toString());
        return client.db('catalog-query-service');
      },
    },
  ],
  exports: ['MONGO_DB'],
})
export class MongoModule {}
