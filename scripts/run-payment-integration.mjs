import { spawnSync } from 'node:child_process';
import { requireTestDatabaseUrl } from './test-database.mjs';

try {
  const url = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  const env = { ...process.env, DB_URL: url, TEST_DATABASE_URL: url };
  const run = (args) => {
    const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  };
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema=apps/auction-service/src/prisma/schema/schema.prisma']);
  if (!process.argv.includes('--migrate-only')) {
    run(['node_modules/vitest/vitest.mjs', 'run',
      'apps/auction-service/src/payment/adapter/out/persistence/payment-concurrency.integration.spec.ts',
      'apps/auction-service/src/payment/adapter/out/persistence/payment-recovery.integration.spec.ts',
      'apps/auction-service/src/auction/adapter/out/postgresql/popular-auction-prisma.integration.spec.ts',
      'apps/auction-service/src/auction/adapter/out/postgresql/demo-auction-prisma.integration.spec.ts',
      'apps/auction-service/src/auction-etc/bid-recovery.integration.spec.ts']);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
