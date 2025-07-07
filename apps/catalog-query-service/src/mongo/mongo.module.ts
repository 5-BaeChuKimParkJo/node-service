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
        const baseUrl = configService.getOrThrow('MONGO_URL');
        const dbName = 'catalog-query-service';
        const [uri, query] = baseUrl.split('?');
        const fullUrl = `${uri}/${dbName}${query ? `?${query}` : ''}`;
        const client = await MongoClient.connect(fullUrl);
        return client.db(dbName);
      },
    },
  ],
  exports: ['MONGO_DB'],
})
export class MongoModule {}
