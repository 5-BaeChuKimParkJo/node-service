import { describe, expect, it, vi } from 'vitest';
import { TaxonomyService } from './application/service/taxonomy.service';
import { TaxonomyRepositoryPort } from './application/port/out/taxonomy-repository.port';

describe('TaxonomyService', () => {
  it('returns categories in stable id order', async () => {
    const categories = [
      { categoryId: 1, name: '디지털', description: '디지털 기기', imageUrl: null },
      { categoryId: 2, name: '패션', description: '의류와 잡화', imageUrl: null },
    ];
    const repository = {
      listCategories: vi.fn().mockResolvedValue(categories),
    } as unknown as TaxonomyRepositoryPort;

    const result = await new TaxonomyService(repository).listCategories();

    expect(repository.listCategories).toHaveBeenCalledOnce();
    expect(result).toEqual(categories);
  });

  it('rejects an unknown category', async () => {
    const repository = {
      findCategory: vi.fn().mockResolvedValue(null),
      findTags: vi.fn().mockResolvedValue([]),
    } as unknown as TaxonomyRepositoryPort;

    await expect(new TaxonomyService(repository).validateSelection(99, [])).rejects.toMatchObject({
      response: { message: '존재하지 않는 카테고리입니다.' },
    });
  });

  it('rejects when any selected tag is unknown', async () => {
    const repository = {
      findCategory: vi.fn().mockResolvedValue({ categoryId: 1 }),
      findTags: vi.fn().mockResolvedValue([{ tagId: 1 }]),
    } as unknown as TaxonomyRepositoryPort;

    await expect(new TaxonomyService(repository).validateSelection(1, [1, 2])).rejects.toMatchObject({
      response: { message: '존재하지 않는 태그가 포함되어 있습니다.' },
    });
  });

  it('accepts a null category and a complete tag selection', async () => {
    const repository = {
      findCategory: vi.fn(),
      findTags: vi.fn().mockResolvedValue([{ tagId: 1 }, { tagId: 2 }]),
    } as unknown as TaxonomyRepositoryPort;

    await expect(new TaxonomyService(repository).validateSelection(null, [1, 2])).resolves.toBeUndefined();
    expect(repository.findCategory).not.toHaveBeenCalled();
  });

  it('resolves self-contained names for the search event', async () => {
    const repository = {
      findCategory: vi.fn().mockResolvedValue({ name: '디지털' }),
      findTags: vi.fn().mockResolvedValue([
        { tagId: 1, name: '미개봉' },
        { tagId: 3, name: '빈티지' },
      ]),
    } as unknown as TaxonomyRepositoryPort;

    await expect(new TaxonomyService(repository).resolveNames(1, [3, 1])).resolves.toEqual({
      categoryName: '디지털',
      tagNames: ['빈티지', '미개봉'],
    });
  });
});
