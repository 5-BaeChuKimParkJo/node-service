import { Module } from '@nestjs/common';
import { BatchService } from './batch.service';
import { PrismaModule } from '../prisma/prisma.module';
import { KafkaModule } from '@app/common/kafka/kafka.module';

@Module({
  imports: [PrismaModule, KafkaModule],
  providers: [BatchService],
})
export class BatchModule {}
