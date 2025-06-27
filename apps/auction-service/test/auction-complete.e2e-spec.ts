import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { S3Service } from '@app/common/s3/s3.service';
import { ZodExceptionFilter } from '@app/common/filter/zod-exception.filter';
import { BigIntToNumberInterceptor } from '@app/common/middleware/bigint-to-number.middleware';
import { execSync } from 'child_process';
import {
  CreateAuctionRequestDto,
  CreateAuctionResponseDto,
} from '../src/auction/adapter/in/web/dto/create-auction.dto';
import { AuctionsResponseDto } from '../src/auction/adapter/in/web/dto/auctions.dto';
import { KafkaService } from '@app/common/kafka/kafka.service';

const userToken1 =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlM2VkZWM4OS0yMjRkLTRkNmEtOGM1NS0zNDcyMzJkYTM0YzIifQ.kaK2nXssT_yG3Z5q0jJnBhXBQFnbZoiQ-UpQENKgwBg';
const userToken2 =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJVdWlkIjoiMTFmM2RmOWEtODJjNC00Y2QxLWJlNzgtNTZmNGE2YTU1MmQ0In0.eVhbBwh3QIw4TK85SOYukUxpPKaiG5i-CvTUubTxWIU';

describe('옥션 완료처리 e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    execSync('docker compose -f docker-compose.test.yml up -d', { stdio: 'inherit' });
    execSync('sleep 3');
    execSync('npm run prisma:auction-service:deploy', { stdio: 'inherit' });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(S3Service)
      .useValue({
        generatePresignedPostUrl: vitest.fn().mockResolvedValue({
          url: 'mocked-url',
          fields: {
            'Content-Type': 'mocked-content-type',
            bucket: 'mocked-bucket',
            'X-Amz-Algorithm': 'mocked-algorithm',
            'X-Amz-Credential': 'mocked-credential',
            'X-Amz-Date': 'mocked-date',
            key: 'mocked-key',
            Policy: 'mocked-policy',
            'X-Amz-Signature': 'mocked-signature',
          },
        }),
        toFullUrl: vitest.fn().mockImplementation((key: string) => `https://mocked-url/${key}`),
        checkFileExists: vitest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
    });
    app.enableCors({
      origin: /^http:\/\/localhost(:\d+)?$/,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      allowedHeaders: 'Content-Type, Accept, Authorization',
      credentials: true,
    });
    app.useGlobalFilters(new ZodExceptionFilter());
    app.useGlobalInterceptors(new BigIntToNumberInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    execSync('docker compose -f docker-compose.test.yml down', { stdio: 'inherit' });
  });

  it('경매 등록', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auctions')
      .set('Authorization', `Bearer ${userToken1}`)
      .send({
        categoryId: 1,
        directDealLocation: `directDealLocation-1`,
        description: `description-1`,
        startAt: '2030-06-05T13:00:00.000Z',
        endAt: '2030-06-05T15:00:00.000Z',
        isDirectDeal: true,
        productCondition: 'unopened',
        thumbnailKey: `auction/e3edec89-224d-4d6a-8c55-347232da34c2/images/1`,
        title: `title-1`,
        minimumBid: 10000,
        tagIds: [1],
        images: [
          {
            key: `auction/e3edec89-224d-4d6a-8c55-347232da34c2/images/1`,
            order: 0,
          },
        ],
      } satisfies CreateAuctionRequestDto);

    expect(res.status).toBe(201);
    const body = res.body as CreateAuctionResponseDto;
    expect(body.auctionUuid).toBeDefined();
    expect(body.categoryId).toBe(1);
    expect(body.directDealLocation).toBe(`directDealLocation-1`);
    expect(body.description).toBe(`description-1`);
    expect(body.startAt).toBe('2030-06-05T13:00:00.000Z');
    expect(body.endAt).toBe('2030-06-05T15:00:00.000Z');
    expect(body.isDirectDeal).toBe(true);
    expect(body.productCondition).toBe('unopened');
  });

  it('판매가자 아닌 사람이 경매 완료 요청시 404 에러 발생', async () => {
    const auctionsRes = await request(app.getHttpServer()).get('/api/v1/auctions');
    expect(auctionsRes.status).toBe(200);
    const auctionsBody = auctionsRes.body as AuctionsResponseDto;
    expect(auctionsBody.items.length).toBe(1);
    const auctionUuid = auctionsBody.items[0].auctionUuid;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/auctions/${auctionUuid}/complete`)
      .set('Authorization', `Bearer ${userToken2}`);

    expect(res.status).toBe(404);
  });

  it('판매자의 경우 경매완료 요청시 200 응답', async () => {
    const auctionsRes = await request(app.getHttpServer()).get('/api/v1/auctions');
    expect(auctionsRes.status).toBe(200);
    const auctionsBody = auctionsRes.body as AuctionsResponseDto;
    expect(auctionsBody.items.length).toBe(1);
    const auctionUuid = auctionsBody.items[0].auctionUuid;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/auctions/${auctionUuid}/complete`)
      .set('Authorization', `Bearer ${userToken1}`);

    expect(res.status).toBe(200);
  });

  it('완료상태로 변경되었는지 조회', async () => {
    const auctionsRes = await request(app.getHttpServer()).get('/api/v1/auctions');
    expect(auctionsRes.status).toBe(200);
    const auctionsBody = auctionsRes.body as AuctionsResponseDto;
    expect(auctionsBody.items.length).toBe(1);
    expect(auctionsBody.items[0].soldAt).not.toBeNull();
  });
});
