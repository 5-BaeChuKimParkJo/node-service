export type Category = { categoryId: number; name: string; description: string; imageUrl: string | null };
export type Tag = { tagId: number; name: string };

export abstract class TaxonomyRepositoryPort {
  abstract listCategories(): Promise<Category[]>;
  abstract listTags(): Promise<Tag[]>;
  abstract findCategory(id: number): Promise<Category | null>;
  abstract findTags(ids: number[]): Promise<Tag[]>;
}
