import { VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AuctionController } from './auction.controller';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';
import { ZodExceptionFilter } from '@app/common/filter/zod-exception.filter';
import { PopularAuctionsController } from './popular-auctions.controller';
import { PopularAuctionService } from '../../../application/service/popular-auction.service';
import { PopularAuctionRepositoryPort } from '../../../application/port/out/popular-auction-repository.port';
import { PopularAuctionCachePort } from '../../../application/port/out/popular-auction-cache.port';

const auctionUuid = '10000000-0000-4000-8000-000000000001';
const viewerUuid = '20000000-0000-4000-8000-000000000002';
const visitorUuid = '30000000-0000-4000-8000-000000000003';
const secret = 'public-ranking-contract-test-secret';

describe('public popular auction HTTP contract', () => {
  let app: NestFastifyApplication;
  let recorded: Array<{ auctionUuid: string; viewerUuid: string }>;

  beforeEach(async () => {
    const dependencies = Reflect.getMetadata('design:paramtypes', AuctionController) as Array<new () => unknown>;
    recorded = [];
    const module = await Test.createTestingModule({
      controllers: [AuctionController, PopularAuctionsController],
      providers: [
        ...dependencies.map((provide) => ({ provide, useValue: {} })),
        PopularAuctionService,
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret }) },
        {
          provide: PopularAuctionRepositoryPort,
          useValue: {
            rank: async () => [],
            findActive: async () => [],
            recordView: async (command: { auctionUuid: string; viewerUuid: string }) => {
              recorded.push(command);
            },
          },
        },
        { provide: PopularAuctionCachePort, useValue: { read: async () => null, write: async () => undefined } },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalFilters(new ZodExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('offers a public ranking without treating popular as an auction UUID', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/auctions/popular' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ items: [], windowHours: 24 });
  });

  it('accepts an anonymous view without asking for a member account', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/auctions/${auctionUuid}/views`,
      payload: { visitorUuid },
    });
    expect(response.statusCode).toBe(204);
    expect(recorded).toEqual([{ auctionUuid, viewerUuid: visitorUuid }]);
  });

  it('uses the signed member identity instead of a caller-supplied visitor UUID', async () => {
    const token = sign({ memberUuid: viewerUuid, role: 'user', token_type: 'access' }, secret, {
      issuer: 'cn-account',
      expiresIn: '1m',
    });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/auctions/${auctionUuid}/views`,
      payload: { visitorUuid },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(204);
    expect(recorded).toEqual([{ auctionUuid, viewerUuid }]);
  });

  it.each(['Bearer invalid', 'Basic invalid'])(
    'rejects invalid authorization instead of falling back to anonymous: %s',
    async (authorization) => {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/auctions/${auctionUuid}/views`,
            payload: { visitorUuid },
            headers: { authorization },
          })
        ).statusCode,
      ).toBe(401);
      expect(recorded).toEqual([]);
    },
  );

  it.each([
    { uuid: auctionUuid, body: {} },
    { uuid: 'invalid', body: { visitorUuid } },
    { uuid: auctionUuid, body: { visitorUuid: 'invalid' } },
    { uuid: auctionUuid, body: { visitorUuid, memberUuid: viewerUuid } },
    { uuid: auctionUuid, body: { visitorUuid: [visitorUuid] } },
  ])('rejects malformed viewer identities without recording a view: %j', async ({ uuid, body }) => {
    expect(
      (await app.inject({ method: 'POST', url: `/api/v1/auctions/${uuid}/views`, payload: body })).statusCode,
    ).toBe(400);
    expect(recorded).toEqual([]);
  });
});
