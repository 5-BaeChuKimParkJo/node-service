import { Body, Controller, Get, Param, Post, Version } from '@nestjs/common';
import { AuctionResponseDto } from './dto/auction-dto';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { ReadService } from './read.service';
import * as TE from 'fp-ts/TaskEither';
import * as F from 'fp-ts/function';
import { AuctionMapper } from './mapper/auction.mapper';
import { AppException, JwtUser, User } from '@app/common';
import { ThumbnailsRequestDto, ThumbnailsResponseDto } from './dto/thumbnails-dto';
import { ProductResponseDto } from './dto/product-dto';
import { ProductMapper } from './mapper/product.mapper';

@Controller()
export class ReadController {
  constructor(private readonly readService: ReadService) {}

  @Get('auctions/:auctionUuid')
  @Version('1')
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuctionResponseDto })
  getAuction(
    @Param('auctionUuid') auctionUuid: string,
    @JwtUser() user: User,
  ): TE.TaskEither<AppException, AuctionResponseDto> {
    return F.pipe(this.readService.auction(auctionUuid, user), TE.map(AuctionMapper.toResponseDto));
  }

  @Post('catalogs/thumbnails')
  @Version('1')
  @ApiOkResponse({ type: [String] })
  getThumbnails(@Body() dto: ThumbnailsRequestDto): TE.TaskEither<AppException, ThumbnailsResponseDto[]> {
    return this.readService.thumbnails(dto.ids);
  }

  @Get('products/:productUuid')
  @Version('1')
  @ApiOkResponse({ type: ProductResponseDto })
  getProduct(
    @Param('productUuid') productUuid: string,
    @JwtUser() user: User,
  ): TE.TaskEither<AppException, ProductResponseDto> {
    return F.pipe(this.readService.product(productUuid, user), TE.map(ProductMapper.toResponseDto));
  }
}
