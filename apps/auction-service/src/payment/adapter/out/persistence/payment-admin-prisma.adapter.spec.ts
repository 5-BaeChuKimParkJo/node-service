import { PrismaService } from '../../../../prisma/prisma.service';
import { PaymentAdminPrismaAdapter } from './payment-admin-prisma.adapter';

describe('PaymentAdminPrismaAdapter SQL boundary', () => {
  const setup = () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    return { queryRaw, adapter: new PaymentAdminPrismaAdapter({ $queryRaw: queryRaw } as unknown as PrismaService) };
  };

  it('classifies before pagination with a parameterized deadline and prioritizes unresolved actions', async () => {
    const { adapter, queryRaw } = setup();
    await adapter.find(
      { attention: 'OVERDUE' },
      {
        asOf: '2026-10-19T00:00:00Z',
        dueHours: 24,
        soonHours: 6,
      },
    );
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.values).toEqual(expect.arrayContaining(['OVERDUE', '2026-10-19T00:00:00Z', 24, 6]));
    expect(sql.text).toContain('auction."endAt"');
    expect(sql.text.indexOf("THEN 'REVIEW_REQUIRED'")).toBeGreaterThan(-1);
    expect(sql.text.indexOf("THEN 'REVIEW_REQUIRED'")).toBeLessThan(sql.text.indexOf("THEN 'OVERDUE'"));
    expect(sql.text).toMatch(/AND review\."attention" = \$\d+/);
    expect(sql.text.indexOf('AND review."attention"')).toBeLessThan(sql.text.indexOf('LIMIT 21'));
  });

  it('selects explicit safe fields and timestamp text, reads the latest numbered attempt and fixes the page bound', async () => {
    const { adapter, queryRaw } = setup();
    await expect(adapter.find({})).resolves.toEqual([]);
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.text).toContain('LEFT JOIN LATERAL');
    expect(sql.text).toContain('ORDER BY a."attemptNumber" DESC');
    expect(sql.text).toContain('LIMIT 1');
    expect(sql.text).toContain('ORDER BY p."createdAt" DESC, p."purchaseUuid" DESC');
    expect(sql.text).toContain('LIMIT 21');
    expect(sql.text).toContain('SS.US');
    expect(sql.text).toContain("AT TIME ZONE 'UTC'");
    expect(sql.text).not.toMatch(
      /SELECT\s+\*|paymentKey|customerKey|[Ii]dempotency|[Ll]ease|FOR UPDATE|UPDATE|INSERT|DELETE/,
    );
  });

  it('parameterizes literal substring search across frozen title and any attempt, with half-open dates and a precise tuple cursor', async () => {
    const { adapter, queryRaw } = setup();
    await adapter.find({
      query: "%'_\\ OR 1=1",
      status: 'PAID',
      from: '2026-10-18T00:00:00.000001Z',
      to: '2026-10-19T00:00:00Z',
      cursor: { createdAt: '2026-10-18T10:00:00.123456Z', purchaseUuid: '10000000-0000-4000-8000-000000000001' },
    });
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.values).toEqual(
      expect.arrayContaining([
        "%'_\\ OR 1=1",
        'PAID',
        '2026-10-18T00:00:00.000001Z',
        '2026-10-19T00:00:00Z',
        '2026-10-18T10:00:00.123456Z',
        '10000000-0000-4000-8000-000000000001',
      ]),
    );
    expect(sql.values.filter((value: unknown) => typeof value === 'number')).toEqual([24, 6]);
    expect(sql.text).not.toContain('OR 1=1');
    expect(sql.text).not.toMatch(/\bLIKE\b|\bILIKE\b/);
    expect(sql.text).toContain('strpos(lower(p."orderName"), lower(');
    expect(sql.text).toContain('EXISTS');
    expect(sql.text).toContain('strpos(lower(search."orderId"), lower(');
    expect(sql.text).toMatch(/p\."createdAt" >= \$\d+::timestamptz/);
    expect(sql.text).toMatch(/p\."createdAt" < \$\d+::timestamptz/);
    expect(sql.text).toMatch(/\(p\."createdAt", p\."purchaseUuid"\) < \(\$\d+::timestamptz, \$\d+::uuid\)/);
  });
});
