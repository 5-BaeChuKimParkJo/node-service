import { Body, Controller, Get, Header, Param, Patch, Post } from '@nestjs/common';
import { JwtUser } from '@app/common/decorator/jwt-user.decorator';
import type { User } from '@app/common/types/user';
import { SellerAuctionService } from '../../../application/service/seller-auction.service';

@Controller({ path: 'auctions/:auctionUuid/seller', version: '1' })
export class SellerAuctionController {
  constructor(private readonly auctions: SellerAuctionService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  read(@JwtUser() user: User, @Param('auctionUuid') id: string) {
    return this.auctions.read(user.memberUuid, id);
  }
  @Patch()
  async update(@JwtUser() user: User, @Param('auctionUuid') id: string, @Body() body: unknown) {
    await this.auctions.change(user.memberUuid, id, body, 'update');
    return { ok: true };
  }
  @Post('cancel')
  async cancel(@JwtUser() user: User, @Param('auctionUuid') id: string, @Body() body: unknown) {
    await this.auctions.change(user.memberUuid, id, body, 'cancel');
    return { ok: true };
  }
}
