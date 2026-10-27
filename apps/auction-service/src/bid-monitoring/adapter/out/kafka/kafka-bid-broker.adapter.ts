import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, logLevel } from 'kafkajs';
import { BidBrokerPort } from '../../../application/port/out/bid-broker.port';
import type { BidBrokerSnapshot } from '../../../application/model/bid-processing-status.result';

const topic = 'auction-service.bidder.created';
const dlq = topic + '.dlq';
type Head = { partition: number; low: string; high: string };
type Commit = { partition: number; offset: string };

export function summarizeBidOffsets(heads: Head[], commits: Commit[]) {
  const partitions = new Set(heads.map((head) => head.partition));
  if (
    !heads.length ||
    partitions.size !== heads.length ||
    commits.length !== heads.length ||
    new Set(commits.map((commit) => commit.partition)).size !== commits.length ||
    commits.some((commit) => !partitions.has(commit.partition))
  ) {
    throw new Error('Incomplete offsets');
  }
  let lag = 0n;
  let retained = 0n;
  let retentionGap = false;
  for (const head of heads) {
    const matches = commits.filter((item) => item.partition === head.partition);
    const commit = matches[0];
    if (
      matches.length !== 1 ||
      !/^\d+$/.test(head.low) ||
      !/^\d+$/.test(head.high) ||
      !/^(?:-1|\d+)$/.test(commit.offset)
    )
      throw new Error('Invalid offsets');
    const low = BigInt(head.low),
      high = BigInt(head.high);
    const offset = commit.offset === '-1' ? low : BigInt(commit.offset);
    if (low > high || offset > high) throw new Error('Inconsistent offsets');
    retentionGap ||= offset < low;
    retained += high - low;
    lag += high - (offset < low ? low : offset);
  }
  return { lag: String(lag), retained: String(retained), retentionGap };
}

@Injectable()
export class KafkaBidBrokerAdapter implements BidBrokerPort {
  constructor(private readonly config: ConfigService) {}

  async snapshot(): Promise<BidBrokerSnapshot> {
    const admin = new Kafka({
      clientId: 'auction-bid-status',
      brokers: this.config.getOrThrow<string>('KAFKA_SERVERS').split(','),
      connectionTimeout: 1500,
      requestTimeout: 1500,
      retry: { retries: 0 },
      logLevel: logLevel.NOTHING,
    }).admin();
    try {
      await admin.connect();
      const topics = await admin.listTopics();
      if (!topics.includes(topic) || !topics.includes(dlq)) throw new Error('Bid topics unavailable');
      const [groups, heads, dlqHeads, commits] = await Promise.allSettled([
        admin.describeGroups([topic]),
        admin.fetchTopicOffsets(topic),
        admin.fetchTopicOffsets(dlq),
        admin.fetchOffsets({ groupId: topic, topics: [topic], resolveOffsets: false }),
      ]);
      if (
        groups.status !== 'fulfilled' ||
        heads.status !== 'fulfilled' ||
        dlqHeads.status !== 'fulfilled' ||
        commits.status !== 'fulfilled'
      ) {
        throw new Error('Bid status queries failed');
      }
      const group = groups.value.groups.find((item) => item.groupId === topic);
      if (!group || !['Stable', 'Empty', 'PreparingRebalance', 'CompletingRebalance'].includes(group.state)) {
        throw new Error('Bid group unavailable');
      }
      const offsets = commits.value.find((item) => item.topic === topic);
      if (!offsets) throw new Error('Bid offsets unavailable');
      const summary = summarizeBidOffsets(heads.value, offsets.partitions);
      const retained = summarizeBidOffsets(
        dlqHeads.value,
        dlqHeads.value.map((head) => ({ partition: head.partition, offset: head.low })),
      );
      return {
        groupState: group.state,
        lag: summary.lag,
        dlqRetained: retained.retained,
        retentionGap: summary.retentionGap,
      };
    } finally {
      await admin.disconnect();
    }
  }
}
