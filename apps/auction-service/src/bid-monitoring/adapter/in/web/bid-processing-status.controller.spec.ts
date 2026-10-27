import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { BidProcessingStatusController } from './bid-processing-status.controller';
import { BidProcessingStatusService } from '../../../application/service/bid-processing-status.service';

describe('internal bid processing status HTTP boundary', () => {
  let app: NestFastifyApplication;
  const get = vi.fn().mockResolvedValue({ broker: 'unavailable', lag: null });
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BidProcessingStatusController],
      providers: [
        { provide: BidProcessingStatusService, useValue: { get } },
        { provide: ConfigService, useValue: new ConfigService({ ADMIN_INTERNAL_TOKEN: 'fixture-internal-token' }) },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    get.mockClear();
  });
  afterEach(async () => {
    await app?.close();
  });
  it('requires the internal token before querying broker state', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/internal/admin/bid-processing-status' });
    expect(response.statusCode).toBe(401);
    expect(get).not.toHaveBeenCalled();
  });
  it('preserves unknown counts and prohibits shared caching', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/admin/bid-processing-status',
      headers: { 'x-admin-internal-token': 'fixture-internal-token' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ broker: 'unavailable', lag: null });
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
