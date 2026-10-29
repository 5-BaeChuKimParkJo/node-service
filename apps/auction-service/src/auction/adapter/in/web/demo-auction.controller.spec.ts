import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { DemoAuctionService } from '../../../application/service/demo-auction.service';
import { DemoAuctionController } from './demo-auction.controller';
import { InternalAdminTokenGuard } from './internal-admin-token.guard';

describe('DemoAuctionController HTTP contract', () => {
  let app: NestFastifyApplication;
  const create = vi.fn();
  const token = 'fixture-internal-demo-token';
  const path = '/api/v1/internal/admin/auctions/demo';
  const result = {
    auctionUuid: '10000000-0000-4000-8000-000000000001',
    title: '[DEMO] Fixture',
    startAt: '2026-10-20T09:00:00.000Z',
    endAt: '2026-10-21T09:00:00.000Z',
  };
  const headers = { 'x-admin-internal-token': token, 'x-admin-actor': 'operator' };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DemoAuctionController],
      providers: [
        InternalAdminTokenGuard,
        { provide: ConfigService, useValue: new ConfigService({ ADMIN_INTERNAL_TOKEN: token }) },
        { provide: DemoAuctionService, useValue: { create } },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    create.mockReset().mockResolvedValue(result);
  });

  it('accepts an authenticated admin request and returns only the new auction identity and schedule', async () => {
    const response = await app.inject({ method: 'POST', url: path, headers, payload: {} });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(result);
    expect(create).toHaveBeenCalledWith(expect.any(Date), 1440);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, 'incorrect'])('denies missing or invalid internal credentials: %s', async (value) => {
    const response = await app.inject({
      method: 'POST',
      url: path,
      payload: {},
      headers: { 'x-admin-actor': 'operator', ...(value ? { 'x-admin-internal-token': value } : {}) },
    });
    expect(response.statusCode).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([{ sellerUuid: 'spoof' }, { templateUuid: 'spoof' }, { startAt: 'spoof' }, []])(
    'rejects client-controlled creation options: %j',
    async (payload) => {
      const response = await app.inject({ method: 'POST', url: path, headers, payload });
      expect(response.statusCode).toBe(400);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('requires an operator identity before creating anything', async () => {
    const response = await app.inject({
      method: 'POST',
      url: path,
      headers: { 'x-admin-internal-token': token },
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([5, 30, 1440])('accepts only the selected numeric duration %i', async (durationMinutes) => {
    const response = await app.inject({ method: 'POST', url: path, headers, payload: { durationMinutes } });
    expect(response.statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.any(Date), durationMinutes);
  });

  it.each([null, '5', 5.5, 0, -5, 60, true, {}, []])(
    'rejects invalid duration %j before creation',
    async (durationMinutes) => {
      const response = await app.inject({ method: 'POST', url: path, headers, payload: { durationMinutes } });
      expect(response.statusCode).toBe(400);
      expect(create).not.toHaveBeenCalled();
    },
  );
});
