import type { Category, Tag } from '../out/taxonomy-repository.port';

export abstract class TaxonomyUseCase {
  abstract listCategories(): Promise<Category[]>;
  abstract listTags(): Promise<Tag[]>;
  abstract validateSelection(categoryId: number | null | undefined, tagIds: number[]): Promise<void>;
  abstract resolveNames(
    categoryId: number | null | undefined,
    tagIds: number[],
  ): Promise<{ categoryName: string | null; tagNames: string[] }>;
}
