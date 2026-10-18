import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TaxonomyRepositoryPort } from '../../../application/port/out/taxonomy-repository.port';

@Injectable()
export class TaxonomyPrismaAdapter extends TaxonomyRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  listCategories() {
    return this.prisma.category.findMany({ orderBy: { categoryId: 'asc' } });
  }
  listTags() {
    return this.prisma.tag.findMany({ orderBy: { tagId: 'asc' } });
  }
  findCategory(categoryId: number) {
    return this.prisma.category.findUnique({ where: { categoryId } });
  }
  findTags(tagIds: number[]) {
    return this.prisma.tag.findMany({ where: { tagId: { in: tagIds } } });
  }
}
