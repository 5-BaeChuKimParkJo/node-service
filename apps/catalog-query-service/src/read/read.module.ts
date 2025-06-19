import { Module } from '@nestjs/common';
import { ReadController } from './read.controller';
import { ReadService } from './read.service';
import { MongoModule } from '../mongo/mongo.module';
import { ReadRepository } from './read.repository';
import { ReadFn } from './read.fn';

@Module({
  imports: [MongoModule],
  controllers: [ReadController],
  providers: [ReadService, ReadRepository, ReadFn],
})
export class ReadModule {}
