import { VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import { ZodExceptionFilter } from '@app/common/filter/zod-exception.filter';
import { AuctionController } from './auction.controller';
import { SavedAuctionsController } from './saved-auctions.controller';
import { SavedAuctionService } from '../../../application/service/saved-auction.service';
import { SavedAuctionRepositoryPort } from '../../../application/port/out/saved-auction-repository.port';

const auction = '10000000-0000-4000-8000-000000000001';
const missing = '10000000-0000-4000-8000-000000000009';
const first = '20000000-0000-4000-8000-000000000002';
const second = '30000000-0000-4000-8000-000000000003';
const secret = 'saved-auction-http-fixture-only-secret';
const root = '/api/v1/auctions';

function token(memberUuid = first, patch: Record<string, unknown> = {}) {
  return sign({ memberUuid, role: 'user', token_type: 'access', ...patch }, secret, {
    issuer: 'cn-account',
    expiresIn: '1m',
  });
}

describe('private saved auction HTTP contract', () => {
  let app: NestFastifyApplication;
  let saved: Set<string>;
  const previousSecret = process.env.JWT_SECRET;
  beforeEach(async () => {
    process.env.JWT_SECRET = secret;
    saved = new Set();
    const dependencies = Reflect.getMetadata('design:paramtypes', AuctionController) as Array<new () => unknown>;
    const module = await Test.createTestingModule({
      controllers: [AuctionController, SavedAuctionsController],
      providers: [
        ...dependencies.map((provide) => ({ provide, useValue: {} })),
        SavedAuctionService,
        {
          provide: SavedAuctionRepositoryPort,
          useValue: {
            state: async (member: string, id: string) => (id === auction ? saved.has(member + '/' + id) : null),
            save: async (member: string, id: string) => {
              if (id !== auction) return false;
              saved.add(member + '/' + id);
              return true;
            },
            remove: async (member: string, id: string) => {
              saved.delete(member + '/' + id);
            },
            list: async (member: string) => ({
              items: saved.has(member + '/' + auction)
                ? [
                    {
                      auctionUuid: auction,
                      title: 'Saved fixture',
                      thumbnailUrl: '/fixture.png',
                      minimumBid: '9007199254740993',
                      currentBid: '9007199254740995',
                      startAt: new Date('2020-01-01Z'),
                      endAt: new Date('2099-01-01Z'),
                      savedAt: new Date('2026-10-29Z'),
                    },
                  ]
                : [],
              nextCursor: null,
            }),
          },
        },
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
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it.each(['GET', 'PUT', 'DELETE'] as const)('requires a verified token for %s state/mutation', async (method) => {
    const result = await app.inject({ method, url: `${root}/${auction}/saved` });
    expect(result.statusCode).toBe(401);
    expect(saved.size).toBe(0);
  });
  it('keeps the saved static route private instead of treating it as an auction UUID', async () => {
    expect((await app.inject({ method: 'GET', url: `${root}/saved` })).statusCode).toBe(401);
    const result = await app.inject({
      method: 'GET',
      url: `${root}/saved`,
      headers: { authorization: `Bearer ${token()}` },
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ items: [], nextCursor: null });
    expect(result.headers['cache-control']).toContain('no-store');
  });
  it.each(['invalid', 'refresh'])('rejects %s tokens and never writes state', async (kind) => {
    const auth = kind === 'invalid' ? 'invalid' : token(first, { token_type: 'refresh' });
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `${root}/${auction}/saved`,
          headers: { authorization: `Bearer ${auth}` },
          payload: {},
        })
      ).statusCode,
    ).toBe(401);
    expect(saved.size).toBe(0);
  });
  it('uses JWT ownership, persists repeated PUT once and isolates another member', async () => {
    const headers = { authorization: `Bearer ${token()}`, 'x-member-uuid': second };
    for (let i = 0; i < 2; i++) {
      const result = await app.inject({ method: 'PUT', url: `${root}/${auction}/saved`, headers, payload: {} });
      expect(result.statusCode).toBe(200);
      expect(result.json()).toEqual({ saved: true });
    }
    expect(saved.size).toBe(1);
    expect((await app.inject({ method: 'GET', url: `${root}/${auction}/saved`, headers })).json()).toEqual({
      saved: true,
    });
    const other = { authorization: `Bearer ${token(second)}` };
    expect((await app.inject({ method: 'GET', url: `${root}/${auction}/saved`, headers: other })).json()).toEqual({
      saved: false,
    });
    expect((await app.inject({ method: 'GET', url: `${root}/saved`, headers: other })).json()).toEqual({
      items: [],
      nextCursor: null,
    });
    const list = await app.inject({ method: 'GET', url: `${root}/saved`, headers });
    expect(list.json().items[0]).toMatchObject({
      currentBid: '9007199254740995',
      minimumBid: '9007199254740993',
      status: 'active',
    });
    expect(list.json().items[0]).not.toHaveProperty('memberUuid');
  });
  it('rejects a caller-owned member field and unexpected mutation data', async () => {
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `${root}/${auction}/saved`,
          headers: { authorization: `Bearer ${token()}` },
          payload: { memberUuid: second },
        })
      ).statusCode,
    ).toBe(400);
    expect(saved.size).toBe(0);
  });
  it('keeps deletion idempotent and scoped to its owner', async () => {
    saved.add(first + '/' + auction);
    saved.add(second + '/' + auction);
    for (let i = 0; i < 2; i++) {
      const result = await app.inject({
        method: 'DELETE',
        url: `${root}/${auction}/saved`,
        headers: { authorization: `Bearer ${token()}` },
      });
      expect(result.statusCode).toBe(200);
      expect(result.json()).toEqual({ saved: false });
    }
    expect(saved.has(second + '/' + auction)).toBe(true);
    expect(saved.has(first + '/' + auction)).toBe(false);
  });
  it('returns 404 for unavailable state/save while allowing idempotent cleanup', async () => {
    const headers = { authorization: `Bearer ${token()}` };
    for (const method of ['GET', 'PUT'] as const)
      expect((await app.inject({ method, url: `${root}/${missing}/saved`, headers })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `${root}/${missing}/saved`, headers })).statusCode).toBe(200);
  });
  it.each(['0', '-1', '1.5', 'abc', '9223372036854775808'])(
    'rejects invalid or overflowing cursor %s',
    async (cursor) => {
      expect(
        (
          await app.inject({
            method: 'GET',
            url: `${root}/saved?cursor=${cursor}`,
            headers: { authorization: `Bearer ${token()}` },
          })
        ).statusCode,
      ).toBe(400);
    },
  );
  it('rejects invalid auction UUIDs and query arrays', async () => {
    const headers = { authorization: `Bearer ${token()}` };
    expect((await app.inject({ method: 'PUT', url: `${root}/invalid/saved`, headers })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: `${root}/saved?cursor=1&cursor=2`, headers })).statusCode).toBe(400);
  });
  it('accepts the frontend JSON DELETE body and rejects spoofed owner fields', async () => {
    saved.add(first + '/' + auction);
    const headers = { authorization: `Bearer ${token()}`, 'content-type': 'application/json' };
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `${root}/${auction}/saved`,
          headers,
          payload: { memberUuid: second },
        })
      ).statusCode,
    ).toBe(400);
    expect(saved.has(first + '/' + auction)).toBe(true);
    const result = await app.inject({ method: 'DELETE', url: `${root}/${auction}/saved`, headers, payload: {} });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ saved: false });
    expect(saved.has(first + '/' + auction)).toBe(false);
  });
});
