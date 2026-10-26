import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { TEST_KAFKA_CLUSTER_ID, requireTestKafkaBroker, requireTestKafkaCluster } from './test-kafka.mjs';

test('accepts explicit loopback broker endpoints on the CI port', () => {
  for (const broker of ['localhost:9092', '127.0.0.1:9092', '[::1]:9092']) {
    assert.equal(requireTestKafkaBroker(broker), broker);
  }
});

test('rejects missing, non-loopback, alternate-port and decorated broker addresses', () => {
  for (const broker of [undefined, '', 'localhost', 'localhost:9093', '100.84.9.65:19092',
    '192.168.1.2:9092', 'broker.example:9092', 'http://localhost:9092',
    'user:password@localhost:9092', 'localhost:9092/path', 'localhost:9092?x=1',
    'localhost:9092#fragment', 'localhost:9092,127.0.0.1:9092']) {
    assert.throws(() => requireTestKafkaBroker(broker), /TEST_KAFKA_BROKER/);
  }
});

test('requires the disposable CI cluster fingerprint before creating resources', () => {
  assert.doesNotThrow(() => requireTestKafkaCluster(TEST_KAFKA_CLUSTER_ID));
  for (const id of [undefined, '', 'MkU3OEVBNTcwNTJENDM2Qk', 'another-cluster']) {
    assert.throws(() => requireTestKafkaCluster(id), /cluster identity/);
  }
});

test('runner rejects unsafe inputs before connecting or running migrations', () => {
  for (const [database, broker, error] of [
    ['postgresql://test:test@127.0.0.1:5432/auction_test', '100.84.9.65:19092', 'TEST_KAFKA_BROKER'],
    ['postgresql://test:test@100.84.9.65:15432/cn_auction', '127.0.0.1:9092', 'TEST_DATABASE_URL'],
  ]) {
    const result = spawnSync(process.execPath, ['scripts/run-kafka-integration.mjs'], {
      encoding: 'utf8', timeout: 5000,
      env: { ...process.env, TEST_DATABASE_URL: database, TEST_KAFKA_BROKER: broker },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(error));
    assert.doesNotMatch(result.stdout, /migrations|Datasource|RUN/);
  }
});
