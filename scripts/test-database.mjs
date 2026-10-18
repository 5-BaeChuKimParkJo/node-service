export function requireTestDatabaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('TEST_DATABASE_URL must be an explicit local test database'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || !/^\/[a-z][a-z0-9_]*_test$/.test(url.pathname)) {
    throw new Error('TEST_DATABASE_URL must use loopback PostgreSQL and a database ending in _test');
  }
  return value;
}
