import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards, Version } from '@nestjs/common';
import { ApiHeader, ApiOkResponse } from '@nestjs/swagger';
import { AuctionAdminService } from '../../../application/service/auction-admin.service';
import { AuctionAdminListRequest, AuctionAdminActionRequest, AuctionAdminBidsRequest } from './dto/auction-admin.dto';
import { AuctionAdminWebMapper } from './mapper/auction-admin-web.mapper';
import { InternalAdminTokenGuard } from './internal-admin-token.guard';

@Controller('/internal/admin/auctions')
@UseGuards(InternalAdminTokenGuard)
@ApiHeader({ name: 'x-admin-internal-token', required: true })
export class AuctionAdminController {
  constructor(private readonly auctionAdminService: AuctionAdminService) {}

  @Version('1')
  @Get()
  @ApiOkResponse({ description: '관리자 경매 목록' })
  list(@Query() request: AuctionAdminListRequest) {
    return this.auctionAdminService.list(AuctionAdminWebMapper.toListCommand(request));
  }

  @Version('1')
  @Get(':auctionUuid')
  @ApiOkResponse({ description: '관리자 경매 상세 및 감사 로그' })
  get(@Param('auctionUuid') auctionUuid: string) {
    return this.auctionAdminService.get(auctionUuid);
  }

  @Version('1')
  @Get(':auctionUuid/bids')
  @ApiOkResponse({ description: 'Paginated admin auction bid history' })
  bids(@Param('auctionUuid') auctionUuid: string, @Query() request: AuctionAdminBidsRequest) {
    return this.auctionAdminService.bids(AuctionAdminWebMapper.toBidsCommand(auctionUuid, request));
  }

  @Version('1')
  @Post(':auctionUuid/actions')
  action(
    @Param('auctionUuid') auctionUuid: string,
    @Headers('x-admin-actor') actor: string,
    @Body() request: AuctionAdminActionRequest,
  ) {
    return this.auctionAdminService.action(AuctionAdminWebMapper.toActionCommand(auctionUuid, actor, request));
  }
}
