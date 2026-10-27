import { ConfigService } from '@nestjs/config';
import { KafkaBidBrokerAdapter, summarizeBidOffsets } from './kafka-bid-broker.adapter';

const { admin } = vi.hoisted(() => ({
  admin: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    listTopics: vi.fn(),
    describeGroups: vi.fn(),
    fetchTopicOffsets: vi.fn(),
    fetchOffsets: vi.fn(),
  },
}));
vi.mock('kafkajs', () => ({
  Kafka: class {
    admin() {
      return admin;
    }
  },
  logLevel: { NOTHING: 0 },
}));
const topic = 'auction-service.bidder.created';

describe('bid broker read-only diagnostics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    admin.connect.mockResolvedValue(undefined);
    admin.disconnect.mockResolvedValue(undefined);
    admin.listTopics.mockResolvedValue([topic, `${topic}.dlq`]);
    admin.describeGroups.mockResolvedValue({ groups: [{ groupId: topic, state: 'Stable' }] });
    admin.fetchTopicOffsets.mockResolvedValue([{ partition: 0, low: '0', high: '5', offset: '5' }]);
    admin.fetchOffsets.mockResolvedValue([{ topic, partitions: [{ partition: 0, offset: '3' }] }]);
  });

  it('calculates large lag across every partition without losing precision', () => {
    expect(
      summarizeBidOffsets(
        [
          { partition: 0, low: '10', high: '9007199254741007' },
          { partition: 1, low: '5', high: '15' },
        ],
        [
          { partition: 0, offset: '10' },
          { partition: 1, offset: '-1' },
        ],
      ),
    ).toEqual({ lag: '9007199254741007', retained: '9007199254741007', retentionGap: false });
  });
  it('flags expired source history and counts only retained work', () => {
    expect(summarizeBidOffsets([{ partition: 0, low: '10', high: '20' }], [{ partition: 0, offset: '3' }])).toEqual({
      lag: '10',
      retained: '10',
      retentionGap: true,
    });
  });
  it.each([
    [[{ partition: 0, low: '2', high: '1' }], [{ partition: 0, offset: '0' }]],
    [[{ partition: 0, low: '0', high: '5' }], [{ partition: 0, offset: '6' }]],
    [[{ partition: 0, low: '0', high: '5' }], []],
    [[{ partition: 0, low: '0', high: '5' }], [{ partition: 0, offset: '-2' }]],
    [[{ partition: 0, low: '0', high: 'bad' }], [{ partition: 0, offset: '1' }]],
    [[], []],
  ])('refuses incomplete or invalid offsets instead of reporting healthy', (heads, commits) => {
    expect(() => summarizeBidOffsets(heads, commits)).toThrow();
  });

  it('queries only the existing fixed topics/group and disconnects', async () => {
    const adapter = new KafkaBidBrokerAdapter(new ConfigService({ KAFKA_SERVERS: '127.0.0.1:9092' }));
    expect(await adapter.snapshot()).toEqual({ groupState: 'Stable', lag: '2', dlqRetained: '5', retentionGap: false });
    expect(admin.fetchOffsets).toHaveBeenCalledWith({ groupId: topic, topics: [topic], resolveOffsets: false });
    expect(admin.disconnect).toHaveBeenCalledTimes(1);
  });
  it('does not read missing topic metadata or create topics', async () => {
    admin.listTopics.mockResolvedValue([topic]);
    await expect(
      new KafkaBidBrokerAdapter(new ConfigService({ KAFKA_SERVERS: 'unused' })).snapshot(),
    ).rejects.toThrow();
    expect(admin.fetchTopicOffsets).not.toHaveBeenCalled();
    expect(admin.disconnect).toHaveBeenCalledTimes(1);
  });
  it('closes a failed connection and rejects unknown group state', async () => {
    admin.connect.mockRejectedValueOnce(new Error('connection failed'));
    const adapter = new KafkaBidBrokerAdapter(new ConfigService({ KAFKA_SERVERS: 'unused' }));
    await expect(adapter.snapshot()).rejects.toThrow();
    expect(admin.disconnect).toHaveBeenCalledTimes(1);
    admin.describeGroups.mockResolvedValue({ groups: [] });
    await expect(adapter.snapshot()).rejects.toThrow();
    expect(admin.disconnect).toHaveBeenCalledTimes(2);
  });
});
