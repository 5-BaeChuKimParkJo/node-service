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
import { AuctionResponseDto } from '../src/auction/adapter/in/web/dto/auction.dto';
import {
  UpdateAuctionRequestDto,
  UpdateAuctionResponseDto,
} from '../src/auction/adapter/in/web/dto/update-auction.dto';
import { CreateAuctionBidderRequestDto } from '../src/auction/adapter/in/web/dto/create-auction-bidder.dto';
import { AuctionBiddersResponseDto } from '../src/auction/adapter/in/web/dto/auction-bidders.dto';

describe('AuctionService e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    execSync('docker compose -f docker-compose.test.yml up -d', { stdio: 'inherit' });
    execSync('sleep 3');
    execSync('pnpm run prisma:auction-service:deploy', { stdio: 'inherit' });
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

  it('30개의 경매 물품 더미데이터 삽입', async () => {
    for (let i = 0; i < 30; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auctions')
        .set(
          'Authorization',
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlM2VkZWM4OS0yMjRkLTRkNmEtOGM1NS0zNDcyMzJkYTM0YzIifQ.kaK2nXssT_yG3Z5q0jJnBhXBQFnbZoiQ-UpQENKgwBg',
        )
        .send({
          categoryId: i,
          directDealLocation: `directDealLocation-${i}`,
          description: `description-${i}`,
          startAt: '2030-06-05T13:00:00.000Z',
          endAt: '2030-06-05T15:00:00.000Z',
          isDirectDeal: true,
          productCondition: 'unopened',
          thumbnailKey: `auction/e3edec89-224d-4d6a-8c55-347232da34c2/images/${i}`,
          title: `title-${i}`,
          minimumBid: 10000,
          tagIds: [i],
          images: [
            {
              key: `auction/e3edec89-224d-4d6a-8c55-347232da34c2/images/${i}`,
              order: 0,
            },
          ],
        } satisfies CreateAuctionRequestDto);

      expect(res.status).toBe(201);
      const body = res.body as CreateAuctionResponseDto;
      expect(body.auctionUuid).toBeDefined();
      expect(body.categoryId).toBe(i);
      expect(body.directDealLocation).toBe(`directDealLocation-${i}`);
      expect(body.description).toBe(`description-${i}`);
      expect(body.startAt).toBe('2030-06-05T13:00:00.000Z');
      expect(body.endAt).toBe('2030-06-05T15:00:00.000Z');
      expect(body.isDirectDeal).toBe(true);
      expect(body.productCondition).toBe('unopened');
    }
  });

  it('경매 물품 조회 및 무한스크롤 조회', async () => {
    const res1 = await request(app.getHttpServer()).get('/api/v1/auctions');

    expect(res1.status).toBe(200);
    const body1 = res1.body as AuctionsResponseDto;
    expect(body1.nextCursor).not.toBeNull();
    expect(body1.items.length).toBe(20);
    expect(body1.items[0].title).toBe('title-29');
    expect(body1.items[body1.items.length - 1].title).toBe('title-10');

    const res2 = await request(app.getHttpServer()).get('/api/v1/auctions').query(body1.nextCursor!);

    expect(res2.status).toBe(200);
    const body2 = res2.body as AuctionsResponseDto;
    expect(body2.nextCursor).toBeNull();
    expect(body2.items.length).toBe(10);
    expect(body2.items[0].title).toBe('title-9');
    expect(body2.items[body2.items.length - 1].title).toBe('title-0');
  });

  it('경매 물품 상세 조회', async () => {
    const listRes = await request(app.getHttpServer()).get('/api/v1/auctions');

    expect(listRes.status).toBe(200);
    const listBody = listRes.body as AuctionsResponseDto;
    const item = listBody.items[0];
    const res = await request(app.getHttpServer()).get(`/api/v1/auctions/${item.auctionUuid}`);

    expect(res.status).toBe(200);
    const body = res.body as AuctionResponseDto;
    expect(body.auctionUuid).toBeDefined();
    expect(body.title).toBe('title-29');
    expect(body.categoryId).toBe(29);
    expect(body.directDealLocation).toBe('directDealLocation-29');
    expect(body.description).toBe('description-29');
    expect(body.startAt).toBe('2030-06-05T13:00:00.000Z');
    expect(body.endAt).toBe('2030-06-05T15:00:00.000Z');
    expect(body.isDirectDeal).toBe(true);
    expect(body.productCondition).toBe('unopened');
  });

  it('경매 상품 업데이트 후 업데이트되었는지 확인', async () => {
    const listRes = await request(app.getHttpServer()).get('/api/v1/auctions');

    expect(listRes.status).toBe(200);
    const listBody = listRes.body as AuctionsResponseDto;
    const item = listBody.items[0];
    const res = await request(app.getHttpServer())
      .put(`/api/v1/auctions/${item.auctionUuid}`)
      .set(
        'Authorization',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlZjNjZjBmMy02MmI4LTQzNzEtYTAxNC02NDNmODIzMjNlZmQiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MTcwMDQ2NTZ9.-ZlQ1vmiXGZ16YVCgTbn_pGmKxKKzE2fvz3vnMQW93U',
      )
      .send({
        title: 'updated-title',
        description: 'updated-description',
        startAt: '2030-06-10T13:00:00.000Z',
        endAt: '2030-06-10T15:00:00.000Z',
        isDirectDeal: false,
        productCondition: 'new',
      } satisfies UpdateAuctionRequestDto);

    expect(res.status).toBe(200);
    const body = res.body as UpdateAuctionResponseDto;
    expect(body.auctionUuid).toBeDefined();
    expect(body.title).toBe('updated-title');
    expect(body.description).toBe('updated-description');
    expect(body.startAt).toBe('2030-06-10T13:00:00.000Z');
    expect(body.endAt).toBe('2030-06-10T15:00:00.000Z');
    expect(body.isDirectDeal).toBe(false);
    expect(body.productCondition).toBe('new');
  });

  it('경매 상품 삭제 후 삭제되었는지 확인', async () => {
    const listRes = await request(app.getHttpServer()).get('/api/v1/auctions');

    expect(listRes.status).toBe(200);
    const listBody = listRes.body as AuctionsResponseDto;
    const item = listBody.items[0];
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/auctions/${item.auctionUuid}`)
      .set(
        'Authorization',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlZjNjZjBmMy02MmI4LTQzNzEtYTAxNC02NDNmODIzMjNlZmQiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MTcwMDQ2NTZ9.-ZlQ1vmiXGZ16YVCgTbn_pGmKxKKzE2fvz3vnMQW93U',
      );

    expect(res.status).toBe(200);

    const listRes2 = await request(app.getHttpServer()).get('/api/v1/auctions');

    expect(listRes2.status).toBe(200);
    const listBody2 = listRes2.body as AuctionsResponseDto;
    expect(listBody2.items.length).toBe(20);
    expect(listBody2.items[0].title).toBe('title-28');

    const listRes3 = await request(app.getHttpServer()).get('/api/v1/auctions').query(listBody2.nextCursor!);

    expect(listRes3.status).toBe(200);
    const listBody3 = listRes3.body as AuctionsResponseDto;
    expect(listBody3.items.length).toBe(9);
    expect(listBody3.items[0].title).toBe('title-8');
  });

  it('경매 상품 입찰 후 입찰되었는지 확인', async () => {
    const listRes = await request(app.getHttpServer()).get('/api/v1/auctions');

    expect(listRes.status).toBe(200);
    const listBody = listRes.body as AuctionsResponseDto;
    const item = listBody.items[0];

    const res = await request(app.getHttpServer())
      .post(`/api/v1/auctions/${item.auctionUuid}/bidders`)
      .set(
        'Authorization',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMzhkNjk0Yy00MDY0LTQyNTgtYTUzMy1lNzE3NTI3YmU2OWQifQ.B1YVXsLtYtorkKiiHpZbWZOzv6GMkXaENmBcCvX-cto',
      )
      .send({
        bidAmount: 10000,
      } satisfies CreateAuctionBidderRequestDto);

    expect(res.status).toBe(201);

    const auctionBiddersRes = await request(app.getHttpServer()).get(`/api/v1/auctions/${item.auctionUuid}/bidders`);

    expect(auctionBiddersRes.status).toBe(200);
    const auctionBiddersBody = auctionBiddersRes.body as AuctionBiddersResponseDto;
    expect(auctionBiddersBody.items.length).toBe(1);
    expect(auctionBiddersBody.items[0].bidAmount).toBe(10000);
  });
});
