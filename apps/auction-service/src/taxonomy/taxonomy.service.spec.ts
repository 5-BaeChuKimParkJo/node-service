import { describe, expect, it, vi } from 'vitest';
import { TaxonomyService } from './taxonomy.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TaxonomyService', () => {
  it('returns categories in stable id order', async () => {
    const categories = [
      { categoryId: 1, name: '디지털', description: '디지털 기기', imageUrl: null },
      { categoryId: 2, name: '패션', description: '의류와 잡화', imageUrl: null },
    ];
    const prisma = {
      category: { findMany: vi.fn().mockResolvedValue(categories) },
    } as unknown as PrismaService;

    const result = await new TaxonomyService(prisma).listCategories();

    expect(prisma.category.findMany).toHaveBeenCalledWith({ orderBy: { categoryId: 'asc' } });
    expect(result).toEqual(categories);
  });

  it('rejects an unknown category', async () => {
    const prisma = {
      category: { findUnique: vi.fn().mockResolvedValue(null) },
      tag: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;

    await expect(new TaxonomyService(prisma).validateSelection(99, [])).rejects.toMatchObject({
      response: { message: '존재하지 않는 카테고리입니다.' },
    });
  });

  it('rejects when any selected tag is unknown', async () => {
    const prisma = {
      category: { findUnique: vi.fn().mockResolvedValue({ categoryId: 1 }) },
      tag: { count: vi.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;

    await expect(new TaxonomyService(prisma).validateSelection(1, [1, 2])).rejects.toMatchObject({
      response: { message: '존재하지 않는 태그가 포함되어 있습니다.' },
    });
  });

  it('accepts a null category and a complete tag selection', async () => {
    const prisma = {
      category: { findUnique: vi.fn() },
      tag: { count: vi.fn().mockResolvedValue(2) },
    } as unknown as PrismaService;

    await expect(new TaxonomyService(prisma).validateSelection(null, [1, 2])).resolves.toBeUndefined();
    expect(prisma.category.findUnique).not.toHaveBeenCalled();
  });

  it('resolves self-contained names for the search event', async () => {
    const prisma = {
      category: { findUnique: vi.fn().mockResolvedValue({ name: '디지털' }) },
      tag: {
        findMany: vi.fn().mockResolvedValue([
          { tagId: 1, name: '미개봉' },
          { tagId: 3, name: '빈티지' },
        ]),
      },
    } as unknown as PrismaService;

    await expect(new TaxonomyService(prisma).resolveNames(1, [3, 1])).resolves.toEqual({
      categoryName: '디지털',
      tagNames: ['빈티지', '미개봉'],
    });
  });
});
