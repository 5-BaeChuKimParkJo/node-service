import { Global, Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { ConfigModule } from '@nestjs/config';
import { envValidate } from '../common/env-schema';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      validate: envValidate,
    }),
  ],
  providers: [KafkaService],
  exports: [KafkaService],
})
export class KafkaModule {}
