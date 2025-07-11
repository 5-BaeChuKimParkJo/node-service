import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuctionEtcRepository } from 'apps/auction-service/src/auction-etc/auction-etc.repository';
import { AuctionEtcFn } from './auction-etc.fn';
import { Prisma } from '../prisma/generated';
import { AuctionEtcService } from './auction-etc.service';
import { Mock } from 'vitest';
import { BidAuctionBatchInput } from './schema/bidder.schema';
import { shuffle } from '@app/common';
import { SendBidMessagesArgs } from './schema/send-bid-messages.schema';

const dummyAuction: Prisma.AuctionsGetPayload<{}> = {
  auctionId: -1n,
  auctionUuid: 'mock',
  currentBidderUuid: 'mock',
  sellerUuid: 'mock',
  currentBid: -1n,
  minimumBid: -1n,
  startAt: new Date(),
  endAt: new Date(),
  description: 'mock',
  directDealLocation: 'mock',
  isDirectDeal: false,
  productCondition: 'new',
  tagIds: [],
  title: 'mock',
  thumbnailKey: 'mock',
  updatedAt: new Date(),
  deletedAt: null,
  version: -1,
  status: 'visible',
  viewCount: -1n,
  soldAt: null,
  categoryId: -1,
  createdAt: new Date(),
};

describe('AuctionEtcService', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AuctionEtcService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: vitest.fn(),
          },
        },
        {
          provide: AuctionEtcRepository,
          useValue: {},
        },
        {
          provide: AuctionEtcRepository,
          useValue: {
            findAcutionsForUpdate: vitest.fn(),
          },
        },
        {
          provide: AuctionEtcFn,
          useValue: {
            sendBidMessages: vitest.fn(),
          },
        },
      ],
    }).compile();
  });

  describe('bidAuctionBatch', () => {
    it('입찰이 가능한 요청(단건, 최초 입찰)이 오면 입찰에 성공해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: null,
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'success',
        },
      ]);
      expect(tx.$executeRawUnsafe.mock.calls[0][0]).toBe(`
        UPDATE \"Auctions\"
        SET 
          \"currentBid\" = v.current_bid,
          \"currentBidderUuid\" = v.current_bidder_uuid 
        FROM (
          VALUES
            ('10000000-0000-0000-0000-000000000000'::uuid, 1000, '20000000-0000-0000-0000-000000000000'::uuid)
        ) AS v(id, current_bid, current_bidder_uuid)
        WHERE \"auctionUuid\" = v.id
      `);

      vi.useRealTimers();
    });

    it('입찰 기간 이전에 요청(단건, 최초 입찰)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-12-31T23:59:59.999Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: null,
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'rejected-period',
        },
      ]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('입찰 기간 이후에 요청(단건, 최초 입찰)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-02T00:00:00.001Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: null,
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'rejected-period',
        },
      ]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('본인의 경매에 입찰 한 요청(단건, 최초 입찰)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-02T00:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: null,
              sellerUuid: '20000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'rejected-seller',
        },
      ]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('최소 입찰가 보다 낮은 요청(단건, 최초 입찰)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: null,
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 999,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 999,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'rejected-amount',
        },
      ]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('최대 입찰가 보다 높은 요청(단건, 최초 입찰)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: null,
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1301,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1301,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'rejected-too-high-bid',
        },
      ]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('최대 입찰가 보다 높은 요청(단건, 최초 입찰)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: null,
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1301,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1301,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'rejected-too-high-bid',
        },
      ]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('입찰이 가능한 요청(단건, 최초 입찰 아님)이 오면 입찰에 성공해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 1000n,
              minimumBid: 1000n,
              currentBidderUuid: '10000000-0000-0000-0000-000000000000',
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1001,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1001,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'success',
        },
      ]);
      expect(tx.$executeRawUnsafe.mock.calls[0][0]).toBe(`
        UPDATE \"Auctions\"
        SET 
          \"currentBid\" = v.current_bid,
          \"currentBidderUuid\" = v.current_bidder_uuid 
        FROM (
          VALUES
            ('10000000-0000-0000-0000-000000000000'::uuid, 1001, '20000000-0000-0000-0000-000000000000'::uuid)
        ) AS v(id, current_bid, current_bidder_uuid)
        WHERE \"auctionUuid\" = v.id
      `);

      vi.useRealTimers();
    });

    it('입찰 기간 이전에 요청(단건, 최초 입찰 아님)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-12-31T23:59:59.999Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: '10000000-0000-0000-0000-000000000000',
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'rejected-period',
        },
      ]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('입찰 기간 이후에 요청(단건, 최초 입찰 아님)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-02T00:00:00.001Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: '10000000-0000-0000-0000-000000000000',
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'rejected-period',
        },
      ]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('본인의 경매에 입찰 한 요청(단건, 최초 입찰 아님)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-02T00:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: '10000000-0000-0000-0000-000000000000',
              sellerUuid: '20000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'rejected-seller',
        },
      ]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('최소 입찰가 보다 낮은 요청(단건, 최초 입찰 아님)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: '10000000-0000-0000-0000-000000000000',
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 999,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 999,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'rejected-amount',
        },
      ]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('최대 입찰가 보다 높은 요청(단건, 최초 입찰 아님)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: '10000000-0000-0000-0000-000000000000',
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1301,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1301,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'rejected-too-high-bid',
        },
      ]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('최대 입찰가 보다 높은 요청(단건, 최초 입찰 아님)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: '10000000-0000-0000-0000-000000000000',
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1301,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1301,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'rejected-too-high-bid',
        },
      ]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('최대 입찰자가 자기 자신인 입찰 요청(단건, 최초 입찰 아님)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: '20000000-0000-0000-0000-000000000000',
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1100,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1100,
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          requestId: '20000000-0000-0000-0000-000000000000',
          type: 'rejected-duplicate',
        },
      ]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('없는 경매에 대해 입찰 요청(단건)이 오면 입찰에 실패해야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '20000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: '20000000-0000-0000-0000-000000000000',
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      await auctionEtcService.bidAuctionBatch([
        {
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1100,
          requestId: '20000000-0000-0000-0000-000000000000',
        },
      ]);

      expect(auctionFn.sendBidMessages).toHaveBeenCalledWith([]);
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('하나의 옥션에 대한 다건 입찰 요청(최초 입찰)에 대해 각각 올바르게 처리되어야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: null,
              sellerUuid: '10000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      const bidders: BidAuctionBatchInput[] = [
        {
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 600,
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '00000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1000,
          createdAt: new Date('2027-01-01T12:00:00.001Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '01000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1100,
          createdAt: new Date('2027-01-01T12:00:00.002Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '02000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '30000000-0000-0000-0000-000000000000',
          bidAmount: 1100,
          createdAt: new Date('2027-01-01T12:00:00.003Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '03000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '40000000-0000-0000-0000-000000000000',
          bidAmount: 1100,
          createdAt: new Date('2027-01-01T12:00:00.004Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '04000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '50000000-0000-0000-0000-000000000000',
          bidAmount: 1050,
          createdAt: new Date('2027-01-01T12:00:00.005Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '05000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '70000000-0000-0000-0000-000000000000',
          bidAmount: 1500,
          createdAt: new Date('2027-01-01T12:00:00.006Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '06000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '80000000-0000-0000-0000-000000000000',
          bidAmount: 1600,
          createdAt: new Date('2027-01-01T12:00:00.007Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '07000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '90000000-0000-0000-0000-000000000000',
          bidAmount: 1200,
          createdAt: new Date('2027-01-01T12:00:00.008Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '08000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '30000000-0000-0000-0000-000000000000',
          bidAmount: 20000,
          createdAt: new Date('2027-01-01T12:00:00.009Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '09000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '40000000-0000-0000-0000-000000000000',
          bidAmount: 20001,
          createdAt: new Date('2027-01-01T12:00:00.009Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '09000000-0000-0000-0000-000000000000',
        },
      ];

      await auctionEtcService.bidAuctionBatch(shuffle(bidders));

      expect(
        (auctionFn.sendBidMessages as Mock).mock.calls[0][0].sort(
          (a: BidAuctionBatchInput, b: BidAuctionBatchInput) => a.createdAt.getTime() - b.createdAt.getTime(),
        ),
      ).toStrictEqual(
        [
          { ...bidders[0], type: 'rejected-amount' },
          { ...bidders[1], type: 'success' },
          { ...bidders[5], type: 'success' },
          { ...bidders[2], type: 'success' },
          { ...bidders[3], type: 'rejected-amount' },
          { ...bidders[4], type: 'rejected-amount' },
          { ...bidders[8], type: 'success' },
          { ...bidders[6], type: 'success' },
          { ...bidders[7], type: 'success' },
          { ...bidders[9], type: 'rejected-too-high-bid' },
          { ...bidders[10], type: 'rejected-too-high-bid' },
        ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
      );
      expect(tx.$executeRawUnsafe.mock.calls[0][0]).toBe(`
        UPDATE \"Auctions\"
        SET 
          \"currentBid\" = v.current_bid,
          \"currentBidderUuid\" = v.current_bidder_uuid 
        FROM (
          VALUES
            ('10000000-0000-0000-0000-000000000000'::uuid, 1600, '80000000-0000-0000-0000-000000000000'::uuid)
        ) AS v(id, current_bid, current_bidder_uuid)
        WHERE \"auctionUuid\" = v.id
      `);

      vi.useRealTimers();
    });

    it('여러개의 옥션에 대한 다건 입찰 요청에 대해 각각 올바르게 처리되어야 한다.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

      const auctionEtcService = module.get(AuctionEtcService);
      const prisma = module.get(PrismaService);
      const auctionFn = module.get(AuctionEtcFn);
      const auctionEtcRepository = module.get(AuctionEtcRepository);

      (auctionEtcRepository.findAcutionsForUpdate as Mock).mockImplementation(
        () =>
          [
            {
              ...dummyAuction,
              auctionId: 1n,
              auctionUuid: '10000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 0n,
              minimumBid: 1000n,
              currentBidderUuid: null,
              sellerUuid: '90000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
            {
              ...dummyAuction,
              auctionId: 2n,
              auctionUuid: '20000000-0000-0000-0000-000000000000',
              startAt: new Date('2025-01-01T00:00:00.000Z'),
              endAt: new Date('2025-01-02T00:00:00.000Z'),
              currentBid: 1100n,
              minimumBid: 1000n,
              currentBidderUuid: '90000000-0000-0000-0000-000000000000',
              sellerUuid: '90000000-0000-0000-0000-000000000000',
              status: 'visible',
              soldAt: null,
            },
          ] satisfies Prisma.AuctionsGetPayload<{}>[],
      );

      const tx = { $executeRawUnsafe: vitest.fn() };
      (prisma.$transaction as Mock).mockImplementation(async (fn) => await fn(tx));

      const bidders: BidAuctionBatchInput[] = [
        {
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 2000,
          createdAt: new Date('2027-01-01T12:00:00.000Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '00000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1500,
          createdAt: new Date('2027-01-01T12:00:00.001Z'),
          auctionUuid: '20000000-0000-0000-0000-000000000000',
          requestId: '01000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '30000000-0000-0000-0000-000000000000',
          bidAmount: 1300,
          createdAt: new Date('2027-01-01T12:00:00.002Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '02000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 500,
          createdAt: new Date('2027-01-01T12:00:00.003Z'),
          auctionUuid: '20000000-0000-0000-0000-000000000000',
          requestId: '03000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '40000000-0000-0000-0000-000000000000',
          bidAmount: 1200,
          createdAt: new Date('2027-01-01T12:00:00.004Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '04000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '10000000-0000-0000-0000-000000000000',
          bidAmount: 1200,
          createdAt: new Date('2027-01-01T12:00:00.005Z'),
          auctionUuid: '20000000-0000-0000-0000-000000000000',
          requestId: '05000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '30000000-0000-0000-0000-000000000000',
          bidAmount: 1300,
          createdAt: new Date('2027-01-01T12:00:00.006Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '06000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '70000000-0000-0000-0000-000000000000',
          bidAmount: 1501,
          createdAt: new Date('2027-01-01T12:00:00.007Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '07000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '20000000-0000-0000-0000-000000000000',
          bidAmount: 1100,
          createdAt: new Date('2027-01-01T12:00:00.008Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '08000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '40000000-0000-0000-0000-000000000000',
          bidAmount: 1300,
          createdAt: new Date('2027-01-01T12:00:00.009Z'),
          auctionUuid: '10000000-0000-0000-0000-000000000000',
          requestId: '09000000-0000-0000-0000-000000000000',
        },
        {
          bidderUuid: '30000000-0000-0000-0000-000000000000',
          bidAmount: 1200,
          createdAt: new Date('2027-01-01T12:00:00.010Z'),
          auctionUuid: '20000000-0000-0000-0000-000000000000',
          requestId: '10000000-0000-0000-0000-000000000000',
        },
      ];

      await auctionEtcService.bidAuctionBatch(shuffle(bidders));

      console.log(
        (auctionFn.sendBidMessages as Mock).mock.calls[0][0]

          .filter((a: BidAuctionBatchInput) => a.auctionUuid === '10000000-0000-0000-0000-000000000000')
          .sort((a: BidAuctionBatchInput, b: BidAuctionBatchInput) => a.bidAmount - b.bidAmount),
      );

      console.log(
        (auctionFn.sendBidMessages as Mock).mock.calls[0][0]

          .filter((a: BidAuctionBatchInput) => a.auctionUuid === '20000000-0000-0000-0000-000000000000')
          .sort((a: BidAuctionBatchInput, b: BidAuctionBatchInput) => a.bidAmount - b.bidAmount),
      );

      expect(
        (auctionFn.sendBidMessages as Mock).mock.calls[0][0].sort(
          (a: BidAuctionBatchInput, b: BidAuctionBatchInput) => a.createdAt.getTime() - b.createdAt.getTime(),
        ),
      ).toStrictEqual(
        [
          { ...bidders[8], type: 'success' },
          { ...bidders[4], type: 'success' },
          { ...bidders[2], type: 'success' },
          { ...bidders[6], type: 'rejected-amount' },
          { ...bidders[9], type: 'rejected-amount' },
          { ...bidders[7], type: 'success' },
          { ...bidders[0], type: 'rejected-too-high-bid' },
          { ...bidders[3], type: 'rejected-amount' },
          { ...bidders[5], type: 'success' },
          { ...bidders[10], type: 'rejected-amount' },
          { ...bidders[1], type: 'success' },
        ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
      );
      expect(tx.$executeRawUnsafe.mock.calls[0][0]).toBe(`
        UPDATE \"Auctions\"
        SET 
          \"currentBid\" = v.current_bid,
          \"currentBidderUuid\" = v.current_bidder_uuid 
        FROM (
          VALUES
            ('10000000-0000-0000-0000-000000000000'::uuid, 1501, '70000000-0000-0000-0000-000000000000'::uuid),('20000000-0000-0000-0000-000000000000'::uuid, 1500, '10000000-0000-0000-0000-000000000000'::uuid)
        ) AS v(id, current_bid, current_bidder_uuid)
        WHERE \"auctionUuid\" = v.id
      `);

      vi.useRealTimers();
    });
  });
});
