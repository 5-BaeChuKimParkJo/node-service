import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuctionEtcRepository } from './auction-etc.repository';
import type { AuctionEtcFn } from './auction-etc.fn';
import type { TaxonomyUseCase } from '../taxonomy/application/port/in/taxonomy.use-case';
import type { S3Service } from '@app/common/s3/s3.service';
import { AuctionEtcService } from './auction-etc.service';

vi.mock('@app/common/kafka/kafka.service', () => ({ KafkaService: class KafkaService {} }));

function fixture(failTransaction = false) {
  const trace: string[] = [];
  const bids: unknown[] = [];
  const tx = {
    $executeRawUnsafe: async () => {
      trace.push('price');
    },
    auctionBidders: {
      createMany: async ({ data }: { data: unknown[] }) => {
        bids.push(...data);
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<void>) => {
      if (failTransaction) throw new Error('fixture transaction failure');
      await callback(tx);
      trace.push('committed');
    },
  };
  const repository = {
    findAuctionsForUpdate: async () => [
      {
        auctionId: 1n,
        auctionUuid: 'auction-fixture',
        sellerUuid: 'seller-fixture',
        startAt: new Date('2020-01-01'),
        endAt: new Date('2090-01-01'),
        minimumBid: 1000n,
        currentBid: 0n,
        currentBidderUuid: null,
        status: 'visible',
        deletedAt: null,
        soldAt: null,
        checkoutLockedAt: null,
      },
    ],
    createAuctionOutbox: async () => {
      trace.push('outbox');
    },
  };
  const notifications = {
    sendBidMessages: vi.fn(async () => {
      trace.push('notification');
      throw new Error('fixture notification secret');
    }),
  };
  const service = new AuctionEtcService(
    prisma as unknown as PrismaService,
    repository as unknown as AuctionEtcRepository,
    notifications as unknown as AuctionEtcFn,
    {} as TaxonomyUseCase,
    {} as S3Service,
  );
  const input = [
    {
      auctionUuid: 'auction-fixture',
      bidderUuid: 'buyer-fixture',
      bidAmount: 1000,
      requestId: 'request',
      createdAt: new Date(),
    },
  ];
  return { service, input, trace, bids, notifications };
}

describe('AuctionEtcService post-commit recovery boundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps an accepted transaction successful if its optional notification fails', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const h = fixture();
    await expect(h.service.bidAuctionBatch(h.input)).resolves.toBeUndefined();
    expect(h.trace).toEqual(['price', 'outbox', 'committed', 'notification']);
    expect(h.bids).toEqual([{ auctionId: 1, bidAmount: 1000n, bidderUuid: 'buyer-fixture' }]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('fixture notification secret');
  });

  it('still rejects a failed transaction and never sends a success notification', async () => {
    const h = fixture(true);
    await expect(h.service.bidAuctionBatch(h.input)).rejects.toThrow('fixture transaction failure');
    expect(h.notifications.sendBidMessages).not.toHaveBeenCalled();
    expect(h.bids).toEqual([]);
  });
});
