import { Controller, Get } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

@Controller('fixture')
class FixtureController {
  @Get('health')
  health() {
    return { healthy: true };
  }
}

describe('Swagger dependency compatibility', () => {
  it('serves generated OpenAPI and its real UI assets with the retained Fastify adapter', async () => {
    const module = await Test.createTestingModule({ controllers: [FixtureController] }).compile();
    const app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    try {
      const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Fixture API').build());
      SwaggerModule.setup('swagger-ui', app, document);
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      const api = await app.inject({ method: 'GET', url: '/swagger-ui-json' });
      expect(api.statusCode).toBe(200);
      expect(api.json()).toMatchObject({ info: { title: 'Fixture API' }, paths: { '/fixture/health': { get: {} } } });
      const html = await app.inject({ method: 'GET', url: '/swagger-ui' });
      expect(html.statusCode).toBe(200);
      expect(html.headers['content-type']).toContain('text/html');
      const css = await app.inject({ method: 'GET', url: '/swagger-ui/swagger-ui.css' });
      expect(css.statusCode).toBe(200);
      expect(css.headers['content-type']).toContain('text/css');
      expect(css.body.length).toBeGreaterThan(100);
    } finally {
      await app.close();
    }
  });
});
