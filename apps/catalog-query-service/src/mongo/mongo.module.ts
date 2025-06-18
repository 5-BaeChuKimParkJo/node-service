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
        const uri = configService.getOrThrow('MONGO_URL');

        const client = await MongoClient.connect(uri);
        return client.db('catalog-query-service');
      },
    },
  ],
  exports: ['MONGO_DB'],
})
export class MongoModule {}
