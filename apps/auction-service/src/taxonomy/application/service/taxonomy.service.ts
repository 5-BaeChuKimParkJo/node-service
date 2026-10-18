import { BadRequestException, Injectable } from '@nestjs/common';
import { TaxonomyRepositoryPort } from '../port/out/taxonomy-repository.port';
import { TaxonomyUseCase } from '../port/in/taxonomy.use-case';

@Injectable()
export class TaxonomyService extends TaxonomyUseCase {
  constructor(private readonly repository: TaxonomyRepositoryPort) {
    super();
  }

  listCategories = () => this.repository.listCategories();

  listTags = () => this.repository.listTags();

  async validateSelection(categoryId: number | null | undefined, tagIds: number[]): Promise<void> {
    if (categoryId != null) {
      const category = await this.repository.findCategory(categoryId);
      if (!category) {
        throw new BadRequestException('존재하지 않는 카테고리입니다.');
      }
    }

    const uniqueTagIds = [...new Set(tagIds)];
    if (uniqueTagIds.length > 0) {
      const existingCount = (await this.repository.findTags(uniqueTagIds)).length;
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
      categoryId == null ? Promise.resolve(null) : this.repository.findCategory(categoryId),
      tagIds.length === 0 ? Promise.resolve([]) : this.repository.findTags(tagIds),
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
