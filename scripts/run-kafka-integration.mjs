import { spawnSync } from 'node:child_process';
import { Kafka, logLevel } from 'kafkajs';
import { requireTestDatabaseUrl } from './test-database.mjs';
import { requireTestKafkaBroker, requireTestKafkaCluster } from './test-kafka.mjs';

try {
  const url = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  const broker = requireTestKafkaBroker(process.env.TEST_KAFKA_BROKER);
  const admin = new Kafka({ brokers: [broker], logLevel: logLevel.NOTHING }).admin();
  try {
    await admin.connect();
    requireTestKafkaCluster((await admin.describeCluster()).clusterId);
  } finally {
    await admin.disconnect();
  }
  const env = { ...process.env, DB_URL: url, TEST_DATABASE_URL: url, TEST_KAFKA_BROKER: broker };
  const run = (args) => {
    const result = spawnSync(process.execPath, args, { stdio: 'inherit', env, timeout: 240000 });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  };
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema=apps/auction-service/src/prisma/schema/schema.prisma']);
  run(['node_modules/vitest/vitest.mjs', 'run', '--no-file-parallelism', '--maxWorkers=1',
    'apps/auction-service/src/auction-etc/bid-kafka.integration.spec.ts']);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
