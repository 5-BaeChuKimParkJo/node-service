export const TEST_KAFKA_CLUSTER_ID = 'Y2hhbG5hay1jaS10ZXN0MQ';

export function requireTestKafkaBroker(value) {
  let url;
  try { url = new URL(`kafka://${value}`); } catch { throw new Error('TEST_KAFKA_BROKER must be explicit loopback:9092'); }
  if (typeof value !== 'string' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.port !== '9092' || url.username || url.password || url.pathname || url.search || url.hash) {
    throw new Error('TEST_KAFKA_BROKER must be an undecorated loopback endpoint on port 9092');
  }
  return value;
}

export function requireTestKafkaCluster(clusterId) {
  if (clusterId !== TEST_KAFKA_CLUSTER_ID) throw new Error('Kafka cluster identity is not the disposable CI fixture');
}
