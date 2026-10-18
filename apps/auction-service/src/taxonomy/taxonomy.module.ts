import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TaxonomyController } from './adapter/in/web/taxonomy.controller';
import { TaxonomyService } from './application/service/taxonomy.service';
import { TaxonomyUseCase } from './application/port/in/taxonomy.use-case';
import { TaxonomyRepositoryPort } from './application/port/out/taxonomy-repository.port';
import { TaxonomyPrismaAdapter } from './adapter/out/persistence/taxonomy-prisma.adapter';

@Module({
  imports: [PrismaModule],
  controllers: [TaxonomyController],
  providers: [
    { provide: TaxonomyUseCase, useClass: TaxonomyService },
    { provide: TaxonomyRepositoryPort, useClass: TaxonomyPrismaAdapter },
  ],
  exports: [TaxonomyUseCase],
})
export class TaxonomyModule {}
