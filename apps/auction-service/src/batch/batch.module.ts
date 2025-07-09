import { Module } from '@nestjs/common';
import { BatchService } from './batch.service';
import { PrismaModule } from '../prisma/prisma.module';
import { KafkaModule } from '@app/common/kafka/kafka.module';
import { BatchRepository } from './batch.repository';
import { BatchFn } from './batch.fn';

@Module({
  imports: [PrismaModule, KafkaModule],
  providers: [BatchService, BatchFn, BatchRepository],
})
export class BatchModule {}
