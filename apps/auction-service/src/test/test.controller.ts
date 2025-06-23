import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaService } from '@app/common/kafka/kafka.service';

@Controller('test')
export class TestController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaService: KafkaService,
  ) {}

  @Get('/')
  async getTest() {
    return 1;
  }

  @Get('/db')
  async getDb() {
    const res = await this.prisma.test.findUnique({
      where: {
        testId: '6853bb1a-d148-8008-b3c0-7b9e24190b62',
      },
    });
    return 1;
  }

  @Get('/db/update')
  async getDbUpdate() {
    console.time('db-update');
    await Promise.all(
      Array.from({ length: 100000 }).map(async () => {
        const res = await this.prisma.test.update({
          where: {
            testId: '6853bb1a-d148-8008-b3c0-7b9e24190b62',
          },
          data: {
            value: Math.floor(Math.random() * 1000),
          },
        });
      }),
    );
    console.timeEnd('db-update');
    return 1;
  }

  @Get('/db/update-rand/:value')
  async getDbUpdateRand(@Param('value') value: number) {
    try {
      const res = await this.prisma.test.update({
        where: {
          testId: '6853bb1a-d148-8008-b3c0-7b9e24190b62',
          value: {
            lt: Number(value),
          },
        },
        data: {
          value,
        },
      });
    } catch {}
    return 1;
  }

  @Get('/kafka-send')
  async getKafkaSend() {
    console.log('rlrl');
    console.time('kafka-send');
    for (let i = 0; i < 1; i++) {
      await Promise.all(
        Array.from({ length: 500000 }).map(
          async () =>
            await this.kafkaService.send({
              topic: `testt`,
              messages: [{ key: 'same-key', value: JSON.stringify({ test: 'test' }) }],
              bulk: true,
            }),
        ),
      );
    }

    // await this.kafkaService.send({
    //   topic: `testt`,
    //   messages: [{ key: String(Math.random()), value: JSON.stringify({ test: 'test' }) }],
    // });
    console.timeEnd('kafka-send');
    return 1;
  }
}
