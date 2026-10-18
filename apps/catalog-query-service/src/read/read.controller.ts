import { Body, Controller, Get, Param, Post, Version } from '@nestjs/common';
import { AuctionResponse } from './dto/auction-dto';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { ReadService } from './read.service';
import * as TE from 'fp-ts/TaskEither';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import { AuctionMapper } from './mapper/auction.mapper';
import { AppException } from '@app/common/common/app.exception';
import { JwtUser } from '@app/common/decorator/jwt-user.decorator';
import { User } from '@app/common/types/user';
import { ThumbnailsRequest, ThumbnailsResponse } from './dto/thumbnails-dto';
import { ProductResponse } from './dto/product-dto';
import { ProductMapper } from './mapper/product.mapper';
import { AuctionsBulkRequest } from './dto/auctions-bulk-dto';
import { UsersAuctionMapper } from './mapper/users-auction.mapper';
import { UsersAuctionResponse } from './dto/users-auction-dto';

@Controller()
export class ReadController {
  constructor(private readonly readService: ReadService) {}

  @Get('auctions/:auctionUuid')
  @Version('1')
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuctionResponse })
  getAuction(
    @Param('auctionUuid') auctionUuid: string,
    @JwtUser() user: User,
  ): TE.TaskEither<AppException, AuctionResponse> {
    return F.pipe(this.readService.auction(auctionUuid, user), TE.map(AuctionMapper.toResponseDto));
  }

  @Post('auctions/bulk')
  @Version('1')
  @ApiOkResponse({ type: [AuctionResponse] })
  getAuctions(@Body() body: AuctionsBulkRequest): TE.TaskEither<AppException, AuctionResponse[]> {
    console.log(body);
    return F.pipe(this.readService.auctions(body.auctionUuids), TE.map(A.map(AuctionMapper.toResponseDto)));
  }

  @Post('catalogs/thumbnails')
  @Version('1')
  @ApiOkResponse({ type: [ThumbnailsResponse] })
  getThumbnails(@Body() dto: ThumbnailsRequest): TE.TaskEither<AppException, ThumbnailsResponse[]> {
    return this.readService.thumbnails(dto.ids);
  }

  @Get('products/:productUuid')
  @Version('1')
  @ApiOkResponse({ type: ProductResponse })
  getProduct(
    @Param('productUuid') productUuid: string,
    @JwtUser() user: User,
  ): TE.TaskEither<AppException, ProductResponse> {
    return F.pipe(this.readService.product(productUuid, user), TE.map(ProductMapper.toResponseDto));
  }

  @Get('users/:memberUuid/auctions')
  @Version('1')
  @ApiOkResponse({ type: [UsersAuctionResponse] })
  getUsersAuctions(@Param('memberUuid') memberUuid: string): TE.TaskEither<AppException, UsersAuctionResponse[]> {
    return F.pipe(this.readService.usersAuctions(memberUuid), TE.map(A.map(UsersAuctionMapper.toResponseDto)));
  }
}
