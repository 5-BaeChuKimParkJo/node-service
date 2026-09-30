import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories = () => this.prisma.category.findMany({ orderBy: { categoryId: 'asc' } });

  listTags = () => this.prisma.tag.findMany({ orderBy: { tagId: 'asc' } });

  async validateSelection(categoryId: number | null | undefined, tagIds: number[]): Promise<void> {
    if (categoryId != null) {
      const category = await this.prisma.category.findUnique({ where: { categoryId } });
      if (!category) {
        throw new BadRequestException('존재하지 않는 카테고리입니다.');
      }
    }

    const uniqueTagIds = [...new Set(tagIds)];
    if (uniqueTagIds.length > 0) {
      const existingCount = await this.prisma.tag.count({ where: { tagId: { in: uniqueTagIds } } });
      if (existingCount !== uniqueTagIds.length) {
        throw new BadRequestException('존재하지 않는 태그가 포함되어 있습니다.');
      }
    }
  }

  async resolveNames(
    categoryId: number | null | undefined,
    tagIds: number[],
  ): Promise<{ categoryName: string | null; tagNames: string[] }> {
    const [category, tags] = await Promise.all([
      categoryId == null
        ? Promise.resolve(null)
        : this.prisma.category.findUnique({ where: { categoryId }, select: { name: true } }),
      tagIds.length === 0
        ? Promise.resolve([])
        : this.prisma.tag.findMany({ where: { tagId: { in: tagIds } }, select: { tagId: true, name: true } }),
    ]);
    const tagNameById = new Map(tags.map((tag) => [tag.tagId, tag.name]));

    return {
      categoryName: category?.name ?? null,
      tagNames: tagIds.flatMap((tagId) => {
        const name = tagNameById.get(tagId);
        return name ? [name] : [];
      }),
    };
  }
}
