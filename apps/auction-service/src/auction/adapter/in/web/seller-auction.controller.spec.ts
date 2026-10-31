import { VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import { AuctionController } from './auction.controller';
import { SellerAuctionController } from './seller-auction.controller';
import { SellerAuctionService } from '../../../application/service/seller-auction.service';
import { SellerAuctionPort } from '../../../application/port/out/seller-auction.port';

const owner = '20000000-0000-4000-8000-000000000002';
const id = '10000000-0000-4000-8000-000000000001';
const other = '30000000-0000-4000-8000-000000000003';
const secret = 'seller-management-http-fixture-only';
const root = '/api/v1/auctions/' + id;
const input = {
  version: 0,
  title: '수정할 경매 제목',
  description: '설명',
  minimumBid: '1000',
  startAt: '2098-01-01T00:00:00Z',
  endAt: '2098-01-02T00:00:00Z',
};
const token = (memberUuid = owner) =>
  sign({ memberUuid, role: 'user', token_type: 'access' }, secret, { issuer: 'cn-account', expiresIn: '1m' });
describe('private seller management HTTP', () => {
  let app: NestFastifyApplication;
  let writes: ReturnType<typeof vi.fn>;
  const previous = process.env.JWT_SECRET;
  beforeEach(async () => {
    process.env.JWT_SECRET = secret;
    writes = vi.fn();
    const deps = Reflect.getMetadata('design:paramtypes', AuctionController) as Array<new () => unknown>;
    const module = await Test.createTestingModule({
      controllers: [AuctionController, SellerAuctionController],
      providers: [
        ...deps.map((provide) => ({ provide, useValue: {} })),
        SellerAuctionService,
        {
          provide: SellerAuctionPort,
          useValue: {
            read: async (member: string, auction: string) =>
              member === owner && auction === id
                ? { auctionUuid: id, ...input, editable: true, status: 'waiting', history: [] }
                : null,
            change: writes,
          },
        },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterEach(async () => {
    await app?.close();
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
  it.each(['GET', 'PATCH', 'POST'] as const)('requires verified auth for %s', async (method) => {
    const result = await app.inject({
      method,
      url: root + '/seller' + (method === 'POST' ? '/cancel' : ''),
      ...(method === 'GET' ? {} : { payload: input }),
    });
    expect(result.statusCode).toBe(401);
    expect(writes).not.toHaveBeenCalled();
  });
  it('reads only JWT owner and refuses spoofed member headers', async () => {
    const good = await app.inject({
      method: 'GET',
      url: root + '/seller',
      headers: { authorization: 'Bearer ' + token() },
    });
    expect(good.statusCode).toBe(200);
    expect(good.headers['cache-control']).toContain('no-store');
    expect(good.json().auctionUuid).toBe(id);
    const denied = await app.inject({
      method: 'GET',
      url: root + '/seller',
      headers: { authorization: 'Bearer ' + token(other), 'x-member-uuid': owner },
    });
    expect(denied.statusCode).toBe(404);
  });
  it('rejects injected mutable fields and passes only JWT actor with validated command', async () => {
    const headers = { authorization: 'Bearer ' + token() };
    expect(
      (await app.inject({ method: 'PATCH', url: root + '/seller', headers, payload: { ...input, sellerUuid: other } }))
        .statusCode,
    ).toBe(400);
    expect(writes).not.toHaveBeenCalled();
    const changed = await app.inject({ method: 'PATCH', url: root + '/seller', headers, payload: input });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toEqual({ ok: true });
    expect(writes).toHaveBeenCalledWith(
      owner,
      id,
      expect.objectContaining({ action: 'update', version: 0, minimumBid: '1000' }),
    );
    const canceled = await app.inject({
      method: 'POST',
      url: root + '/seller/cancel',
      headers,
      payload: { version: 0, reasonCode: 'other', reasonDetail: '  판매 불가  ' },
    });
    expect(canceled.statusCode).toBe(201);
    expect(canceled.json()).toEqual({ ok: true });
    expect(writes).toHaveBeenLastCalledWith(owner, id, {
      action: 'cancel',
      version: 0,
      reasonCode: 'other',
      reasonDetail: '판매 불가',
    });
  });
  it.each(['PUT', 'DELETE'] as const)('closes legacy %s seller mutation bypass', async (method) => {
    const result = await app.inject({
      method,
      url: root,
      headers: { authorization: 'Bearer ' + token() },
      payload: { soldAt: '2026-10-31T00:00:00Z' },
    });
    expect(result.statusCode).toBe(403);
    expect(writes).not.toHaveBeenCalled();
  });
});
