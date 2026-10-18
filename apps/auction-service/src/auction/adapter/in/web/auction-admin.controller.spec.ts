import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { BigIntToNumberInterceptor } from '@app/common/middleware/bigint-to-number.middleware';
import { ZodExceptionFilter } from '@app/common/filter/zod-exception.filter';
import { AuctionAdminController } from './auction-admin.controller';
import { InternalAdminTokenGuard } from './internal-admin-token.guard';
import { AuctionAdminService } from '../../../application/service/auction-admin.service';
import { AuctionAdminMapper } from '../../../application/mapper/auction-admin.mapper';
import { AuctionRepositoryPort } from '../../../application/port/out/auction-repository.port';
import { AuctionPrismaAdapter } from '../../out/postgresql/auction-prisma.adapter';
import AdminAuction from '../../../domain/model/admin-auction';

const auctionUuid = '10000000-0000-0000-0000-000000000000';
const auctionBidderUuid = '20000000-0000-0000-0000-000000000000';
const bidderUuid = '30000000-0000-0000-0000-000000000000';
const token = 'internal-auction-history-test-token';
const path = `/api/v1/internal/admin/auctions/${auctionUuid}/bids`;
const createdAt = '2026-10-13T02:34:56.123456Z';

describe('AuctionAdminController bid history HTTP contract', () => {
  let app: NestFastifyApplication;
  let repository: AuctionPrismaAdapter;
  const tx = {
    auctions: { findUnique: vi.fn() },
    auctionBidders: { count: vi.fn() },
    $queryRaw: vi.fn(),
  };

  beforeAll(async () => {
    const prisma = { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
    repository = new AuctionPrismaAdapter(prisma as never, {} as never, {} as never);
    const module = await Test.createTestingModule({
      controllers: [AuctionAdminController],
      providers: [
        AuctionAdminService,
        InternalAdminTokenGuard,
        { provide: ConfigService, useValue: new ConfigService({ ADMIN_INTERNAL_TOKEN: token }) },
        { provide: AuctionAdminMapper, useValue: new AuctionAdminMapper({ toFullUrl: (key: string) => key } as never) },
        {
          provide: AuctionRepositoryPort,
          useValue: repository,
        },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalFilters(new ZodExceptionFilter());
    app.useGlobalInterceptors(new BigIntToNumberInterceptor());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    tx.auctions.findUnique.mockResolvedValue({ auctionId: 42n, status: 'hidden', deletedAt: new Date() });
    tx.auctionBidders.count.mockResolvedValue(1);
    tx.$queryRaw.mockResolvedValue([{ auctionBidderUuid, bidderUuid, bidAmount: 9007199254740993n, createdAt }]);
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each(['list', 'detail', 'action'] as const)(
    'serializes all existing admin %s dates as ISO strings through the global interceptor',
    async (route) => {
      const date = new Date('2026-10-13T02:00:00.000Z');
      const auction = new AdminAuction({
        auctionId: 42n,
        auctionUuid,
        categoryId: null,
        title: 'Auction date regression',
        description: '',
        minimumBid: 9007199254740993n,
        currentBid: 9007199254740995n,
        currentBidderUuid: null,
        startAt: date,
        endAt: new Date('2026-10-13T05:00:00.000Z'),
        soldAt: date,
        isDirectDeal: false,
        directDealLocation: null,
        status: 'hidden',
        productCondition: 'used',
        viewCount: 1n,
        thumbnailKey: 'thumbnail.jpg',
        createdAt: date,
        updatedAt: date,
        deletedAt: date,
        sellerUuid: bidderUuid,
        version: 7,
        tagIds: [],
        images: [],
      });
      vi.spyOn(repository, 'findAuctions').mockResolvedValue({
        items: [auction],
        nextCursor: { createdAt: date, auctionUuid },
      });
      vi.spyOn(repository, 'findAuction').mockResolvedValue(auction);
      vi.spyOn(repository, 'applyAdminAction').mockResolvedValue(auction);
      vi.spyOn(repository, 'findAdminActions').mockResolvedValue([
        {
          auctionAdminActionId: auctionBidderUuid,
          actor: 'operator',
          action: 'hide',
          reason: 'Review',
          previousStatus: 'active',
          nextStatus: 'hidden',
          createdAt: date,
        },
      ]);

      const url = `/api/v1/internal/admin/auctions${route === 'list' ? '' : `/${auctionUuid}`}${route === 'action' ? '/actions' : ''}`;
      const response = await app.inject({
        method: route === 'action' ? 'POST' : 'GET',
        url,
        headers: { 'x-admin-internal-token': token, 'x-admin-actor': 'operator' },
        ...(route === 'action' ? { payload: { action: 'hide', reason: 'Review' } } : {}),
      });
      expect(response.statusCode).toBe(route === 'action' ? 201 : 200);
      const body = response.json();
      const item = route === 'list' ? body.items[0] : body;
      expect(item).toMatchObject({
        createdAt: '2026-10-13T02:00:00.000Z',
        startAt: '2026-10-13T02:00:00.000Z',
        endAt: '2026-10-13T05:00:00.000Z',
        soldAt: '2026-10-13T02:00:00.000Z',
        updatedAt: '2026-10-13T02:00:00.000Z',
        deletedAt: '2026-10-13T02:00:00.000Z',
        visibility: 'hidden',
        version: 7,
        minimumBid: '9007199254740993',
        currentBid: '9007199254740995',
      });
      if (route === 'list') {
        expect(body.nextCursor).toEqual({ createdAt: '2026-10-13T02:00:00.000Z', auctionUuid });
      } else {
        expect(body.auditLogs[0].createdAt).toBe('2026-10-13T02:00:00.000Z');
      }
    },
  );

  it('returns only the bid contract fields with exact money and timestamp precision', async () => {
    const response = await app.inject({ method: 'GET', url: path, headers: { 'x-admin-internal-token': token } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [{ auctionBidderUuid, bidderUuid, bidAmount: '9007199254740993', createdAt }],
      totalCount: 1,
      nextCursor: null,
    });
  });

  it.each([undefined, 'incorrect-token'])('rejects unauthorized reads with token %s', async (value) => {
    const response = await app.inject({
      method: 'GET',
      url: path,
      headers: value ? { 'x-admin-internal-token': value } : {},
    });
    expect(response.statusCode).toBe(401);
    expect(tx.auctions.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    '?createdAt=2026-10-13T02:34:56.123456Z',
    `?auctionBidderUuid=${auctionBidderUuid}`,
    `?createdAt=invalid&auctionBidderUuid=${auctionBidderUuid}`,
    '?createdAt=2026-10-13T02:34:56Z&auctionBidderUuid=invalid',
    `?createdAt=2026-02-30T02:34:56Z&auctionBidderUuid=${auctionBidderUuid}`,
    '?createdAt=&auctionBidderUuid=',
    `?createdAt=2026-10-13T02:34:56Z&createdAt=2026-10-14T02:34:56Z&auctionBidderUuid=${auctionBidderUuid}`,
  ])('rejects an invalid or incomplete cursor %s', async (query) => {
    const response = await app.inject({
      method: 'GET',
      url: path + query,
      headers: { 'x-admin-internal-token': token },
    });
    expect(response.statusCode).toBe(400);
    expect(tx.auctions.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an invalid auction UUID before reaching the repository', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/admin/auctions/invalid/bids',
      headers: { 'x-admin-internal-token': token },
    });
    expect(response.statusCode).toBe(400);
    expect(tx.auctions.findUnique).not.toHaveBeenCalled();
  });

  it('accepts a complete ISO cursor without truncating fractional seconds', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${path}?createdAt=${createdAt}&auctionBidderUuid=${auctionBidderUuid}`,
      headers: { 'x-admin-internal-token': token },
    });
    expect(response.statusCode).toBe(200);
    expect(tx.$queryRaw.mock.calls[0][0].values).toContain(createdAt);
  });

  it('accepts ISO timezone offsets', async () => {
    const offset = encodeURIComponent('2026-10-13T11:34:56.123456+09:00');
    const response = await app.inject({
      method: 'GET',
      url: `${path}?createdAt=${offset}&auctionBidderUuid=${auctionBidderUuid}`,
      headers: { 'x-admin-internal-token': token },
    });
    expect(response.statusCode).toBe(200);
  });

  it('returns 404 for an absent auction', async () => {
    tx.auctions.findUnique.mockResolvedValue(null);
    const response = await app.inject({ method: 'GET', url: path, headers: { 'x-admin-internal-token': token } });
    expect(response.statusCode).toBe(404);
  });

  it('returns an empty page for an existing auction with no bids', async () => {
    tx.auctionBidders.count.mockResolvedValue(0);
    tx.$queryRaw.mockResolvedValue([]);
    const response = await app.inject({ method: 'GET', url: path, headers: { 'x-admin-internal-token': token } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], totalCount: 0, nextCursor: null });
  });
});
