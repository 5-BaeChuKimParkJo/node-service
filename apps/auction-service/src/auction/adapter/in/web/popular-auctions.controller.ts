import { Body, Controller, Get, Headers, HttpCode, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyAccessToken } from '@app/common/decorator/jwt-user.decorator';
import { z } from 'zod';
import { PopularAuctionService } from '../../../application/service/popular-auction.service';

const uuid = z.string().uuid();
const viewSchema = z.object({ visitorUuid: uuid.optional() }).strict();

@Controller({ path: 'auctions', version: '1' })
export class PopularAuctionsController {
  constructor(
    private readonly popular: PopularAuctionService,
    private readonly config: ConfigService,
  ) {}

  @Get('popular')
  list() {
    return this.popular.list();
  }

  @Post(':auctionUuid/views')
  @HttpCode(204)
  async recordView(
    @Param('auctionUuid') auctionUuid: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ): Promise<void> {
    uuid.parse(auctionUuid);
    const { visitorUuid } = viewSchema.parse(body ?? {});
    let viewerUuid: string;
    if (authorization !== undefined) {
      try {
        if (!authorization.startsWith('Bearer ')) throw new Error('Invalid authorization');
        viewerUuid = verifyAccessToken(authorization.slice(7), this.config.getOrThrow<string>('JWT_SECRET')).memberUuid;
      } catch {
        throw new UnauthorizedException();
      }
    } else {
      viewerUuid = uuid.parse(visitorUuid);
    }
    await this.popular.recordView({ auctionUuid, viewerUuid });
  }
}
