import { BadRequestException, Body, Controller, Headers, Logger, Post, UseGuards, Version } from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';
import { DemoAuctionService } from '../../../application/service/demo-auction.service';
import { InternalAdminTokenGuard } from './internal-admin-token.guard';
import { z } from 'zod';

const demoRequestSchema = z
  .object({
    durationMinutes: z.union([z.literal(5), z.literal(30), z.literal(1440)]).optional(),
  })
  .strict();

@Controller('/internal/admin/auctions')
@UseGuards(InternalAdminTokenGuard)
@ApiHeader({ name: 'x-admin-internal-token', required: true })
@ApiHeader({ name: 'x-admin-actor', required: true })
export class DemoAuctionController {
  private readonly logger = new Logger(DemoAuctionController.name);

  constructor(private readonly demoAuctionService: DemoAuctionService) {}

  @Version('1')
  @Post('demo')
  @ApiOperation({ summary: 'Create one active portfolio demo auction from the configured template' })
  async create(@Headers('x-admin-actor') actor: string | undefined, @Body() body: unknown) {
    if (typeof actor !== 'string' || !actor.trim() || actor.length > 100) {
      throw new BadRequestException('관리자 식별자가 필요합니다.');
    }
    const request = demoRequestSchema.safeParse(body === undefined ? {} : body);
    if (!request.success) throw new BadRequestException('데모 운영 시간은 5분, 30분 또는 24시간을 선택해 주세요.');
    const result = await this.demoAuctionService.create(new Date(), request.data.durationMinutes ?? 1440);
    this.logger.log({ event: 'demo-auction.created', actor: actor.trim(), auctionUuid: result.auctionUuid });
    return result;
  }
}
