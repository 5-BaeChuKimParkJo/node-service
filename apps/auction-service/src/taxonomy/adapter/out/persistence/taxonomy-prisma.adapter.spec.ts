import { TaxonomyPrismaAdapter } from './taxonomy-prisma.adapter';

describe('TaxonomyPrismaAdapter', () => {
  it('retains stable category and tag ordering', async () => {
    const prisma = {
      category: { findMany: vi.fn().mockResolvedValue([]) },
      tag: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const adapter = new TaxonomyPrismaAdapter(prisma as never);
    await adapter.listCategories();
    await adapter.listTags();
    expect(prisma.category.findMany).toHaveBeenCalledWith({ orderBy: { categoryId: 'asc' } });
    expect(prisma.tag.findMany).toHaveBeenCalledWith({ orderBy: { tagId: 'asc' } });
  });

  it('looks up only the requested category and tag ids', async () => {
    const prisma = {
      category: { findUnique: vi.fn().mockResolvedValue(null) },
      tag: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const adapter = new TaxonomyPrismaAdapter(prisma as never);
    await adapter.findCategory(3);
    await adapter.findTags([4, 1]);
    expect(prisma.category.findUnique).toHaveBeenCalledWith({ where: { categoryId: 3 } });
    expect(prisma.tag.findMany).toHaveBeenCalledWith({ where: { tagId: { in: [4, 1] } } });
  });
});
