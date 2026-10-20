import { BadRequestException, Body, Controller, Headers, Logger, Post, UseGuards, Version } from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';
import { DemoAuctionService } from '../../../application/service/demo-auction.service';
import { InternalAdminTokenGuard } from './internal-admin-token.guard';

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
    if (body != null && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 0)) {
      throw new BadRequestException('데모 경매의 생성 옵션은 서버에서 지정합니다.');
    }
    const result = await this.demoAuctionService.create();
    this.logger.log({ event: 'demo-auction.created', actor: actor.trim(), auctionUuid: result.auctionUuid });
    return result;
  }
}
