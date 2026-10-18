import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireTestDatabaseUrl } from './test-database.mjs';

test('requires an explicit isolated local test database', () => {
  for (const value of [undefined, '', 'postgresql://localhost/auction', 'postgresql://100.84.9.65/auction_test',
    'postgresql://oracle.example/auction_test', 'https://localhost/auction_test']) {
    assert.throws(() => requireTestDatabaseUrl(value), /TEST_DATABASE_URL/);
  }
});

test('accepts only loopback PostgreSQL URLs with a test database suffix', () => {
  const value = 'postgresql://test:test@127.0.0.1:5432/auction_test?connection_limit=10';
  assert.equal(requireTestDatabaseUrl(value), value);
});
