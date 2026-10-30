import { Test } from '@nestjs/testing';
import { VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import * as jwt from 'jsonwebtoken';
import { MySalesController } from './my-sales.controller';
import { MySalesService } from '../../../application/service/my-sales.service';
import { MySalesQueryPort } from '../../../application/port/out/my-sales-query.port';
import { AuctionController } from './auction.controller';

const owner = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const secret = 'my-sales-http-fixture-only';
const summary = { total: 1, waiting: 0, active: 1, ended: 0, hidden: 0, cancelled: 0 };
const token = (claims: Record<string, unknown> = {}) =>
  jwt.sign({ memberUuid: owner, role: 'user', token_type: 'access', ...claims }, secret, {
    algorithm: 'HS256',
    issuer: 'cn-account',
    expiresIn: '10m',
  });

describe('private seller auction HTTP query', () => {
  let app: NestFastifyApplication;
  const previousSecret = process.env.JWT_SECRET;
  const list = vi.fn();
  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({
      controllers: [MySalesController, AuctionController],
      providers: [MySalesService, { provide: MySalesQueryPort, useValue: { list } }],
    })
      .useMocker(() => ({}))
      .compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await app?.close();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  beforeEach(() => {
    list.mockReset();
    list.mockResolvedValue({
      items: [
        {
          auctionUuid: owner,
          title: 'Owned',
          thumbnailUrl: '/fixture.png',
          minimumBid: '9007199254740993',
          currentBid: '9007199254740995',
          bidCount: 3,
          startAt: new Date('2020-01-01T00:00:00Z'),
          endAt: new Date('2099-01-01T00:00:00Z'),
          createdAt: new Date('2026-10-30T00:00:00Z'),
          status: 'active',
        },
      ],
      summary,
      total: 1,
    });
  });
  it.each([undefined, 'invalid', token({ token_type: 'refresh' }), token({ memberUuid: 'invalid' })])(
    'rejects missing or invalid access identity without querying persistence',
    async (value) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auctions/mine',
        headers: value ? { authorization: 'Bearer ' + value } : {},
      });
      expect(response.statusCode).toBe(401);
      expect(list).not.toHaveBeenCalled();
    },
  );
  it('matches the static route, scopes JWT owner and projects exact private display data', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auctions/mine',
      headers: { authorization: 'Bearer ' + token(), 'x-member-uuid': other },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(list.mock.calls[0][0]).toBe(owner);
    expect(list.mock.calls[0][1]).toEqual({ q: '', status: 'all', sort: 'recent', page: 1 });
    expect(response.json()).toMatchObject({
      page: 1,
      pageSize: 20,
      summary,
      total: 1,
      items: [{ currentBid: '9007199254740995', bidCount: 3, status: 'active', createdAt: '2026-10-30T00:00:00.000Z' }],
    });
    expect(response.body).not.toContain('sellerUuid');
  });
  it('validates and forwards literal search, status, sorting and page', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auctions/mine?q=%20%25_%20&status=hidden&sort=price&page=2',
      headers: { authorization: 'Bearer ' + token() },
    });
    expect(response.statusCode).toBe(200);
    expect(list.mock.calls[0][1]).toEqual({ q: '%_', status: 'hidden', sort: 'price', page: 2 });
  });
  it.each([
    'page=0',
    'page=-1',
    'page=1.5',
    'page=abc',
    'page=10001',
    'page=1&page=2',
    'status=sold',
    'sort=invalid',
    'memberUuid=' + other,
    'q=' + 'a'.repeat(81),
  ])('rejects malformed query %s before persistence', async (query) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auctions/mine?' + query,
      headers: { authorization: 'Bearer ' + token() },
    });
    expect(response.statusCode).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });
});
