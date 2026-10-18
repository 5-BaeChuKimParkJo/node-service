import { Body, Controller, Delete, Get, Param, Post, Put, Query, Version } from '@nestjs/common';
import { CreateAuctionUseCase } from '../../../application/port/in/create-auction.use-case';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { JwtUser } from '@app/common/decorator/jwt-user.decorator';
import { User } from '@app/common/types/user';
import { UpdateAuctionUseCase } from '../../../application/port/in/update-auction.use-case';
import { AuctionsUseCase } from '../../../application/port/in/auctions.use-case';
import { DeleteAuctionUseCase } from '../../../application/port/in/delete-auction.use-case';
import { AuctionsRequest, AuctionsResponse } from './dto/auctions.dto';
import { CreateAuctionRequest, CreateAuctionResponse } from './dto/create-auction.dto';
import { UpdateAuctionRequest, UpdateAuctionResponse } from './dto/update-auction.dto';
import { AuctionsWebMapper } from './mapper/auctions-web.mapper';
import { CreateAuctionWebMapper } from './mapper/create-auction-web.mapper';
import { UpdateAuctionWebMapper } from './mapper/update-auction-web.mapper';
import { PresignedUrlRequest, PresignedUrlResponse } from './dto/presigned-url.dto';
import { PresignedUrlUseCase } from '../../../application/port/in/presigned-url.use-case';
import { AuctionUseCase } from '../../../application/port/in/auction.use-case';
import { AuctionResponse } from './dto/auction.dto';
import { AuctionWebMapper } from './mapper/auction-web.mapper';
import { CreateAuctionBidderRequest } from './dto/create-auction-bidder.dto';
import { CreateAuctionBidderUseCase } from '../../../application/port/in/create-auction-bidder.use-case';
import { CreateAuctionBidderWebMapper } from './mapper/create-auction-bidder-web.mapper';
import { AuctionBiddersResponse } from './dto/auction-bidders.dto';
import { AuctionBiddersRequest } from './dto/auction-bidders.dto';
import { AuctionBiddersWebMapper } from './mapper/auction-bidders-web.mapper';
import { AuctionBiddersUseCase } from '../../../application/port/in/auction-bidders.use-case';
import { AuctionsByIdsItemResponse, AuctionsByIdsRequest } from './dto/auctions-by-ids.dto';
import { AuctionsByIdsUseCase } from '../../../application/port/in/auctions-by-ids.use-case';
import { AuctionsByIdsWebMapper } from './mapper/auctions-by-ids-web.mapper';
import { CreateAuctionBidderKafkaWebMapper } from './mapper/create-auction-bidder-kafka-web.mapper';
import { CreateAuctionBidderKafkaUseCase } from '../../../application/port/in/create-auction-bidder-kafka.use-case';
import { AuctionSoldUseCase } from '../../../application/port/in/auction-sold.use-case';
import { AuctionSoldWebMapper } from './mapper/auction-sold-web.mapper';

@Controller('/auctions')
export class AuctionController {
  constructor(
    private readonly auctionUseCase: AuctionUseCase,
    private readonly auctionsUseCase: AuctionsUseCase,
    private readonly auctionsByIdsUseCase: AuctionsByIdsUseCase,
    private readonly createAuctionUseCase: CreateAuctionUseCase,
    private readonly updateAuctionUseCase: UpdateAuctionUseCase,
    private readonly deleteAuctionUseCase: DeleteAuctionUseCase,
    private readonly presignedUrlUseCase: PresignedUrlUseCase,
    private readonly auctionBiddersUseCase: AuctionBiddersUseCase,
    private readonly createAuctionBidderUseCase: CreateAuctionBidderUseCase,
    private readonly createAuctionBidderKafkaUseCase: CreateAuctionBidderKafkaUseCase,
    private readonly auctionSoldUseCase: AuctionSoldUseCase,
  ) {}

  @Version('1')
  @Get(':auctionUuid')
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuctionResponse })
  async auctionV1(@Param('auctionUuid') auctionUuid: string): Promise<AuctionResponse> {
    const command = AuctionWebMapper.toCommand(auctionUuid);
    const response = await this.auctionUseCase.execute(command);
    return AuctionWebMapper.fromResponse(response);
  }

  @Version('1')
  @Get()
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuctionsResponse })
  async auctionsV1(@Query() requestDto: AuctionsRequest): Promise<AuctionsResponse> {
    const command = AuctionsWebMapper.toCommand(requestDto);
    const response = await this.auctionsUseCase.execute(command);
    return AuctionsWebMapper.fromResponse(response);
  }

  @Version('1')
  @Post('/bulk')
  @ApiBearerAuth()
  @ApiOkResponse({ type: [AuctionsByIdsItemResponse] })
  async auctionsByIdsV1(@Body() requestDto: AuctionsByIdsRequest): Promise<AuctionsByIdsItemResponse[]> {
    const command = AuctionsByIdsWebMapper.toCommand(requestDto);
    const response = await this.auctionsByIdsUseCase.execute(command);
    return AuctionsByIdsWebMapper.fromResponse(response);
  }

  @Version('1')
  @Post()
  @ApiBearerAuth()
  @ApiOkResponse({ type: CreateAuctionResponse })
  async createAuctionV1(
    @JwtUser() user: User,
    @Body() requestDto: CreateAuctionRequest,
  ): Promise<CreateAuctionResponse> {
    const command = CreateAuctionWebMapper.toCommand(requestDto);
    const response = await this.createAuctionUseCase.execute(command, user);
    return CreateAuctionWebMapper.fromResponse(response);
  }

  @Version('1')
  @Put(':auctionUuid')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UpdateAuctionResponse })
  async updateAuctionV1(
    @Param('auctionUuid') auctionUuid: string,
    @JwtUser() user: User,
    @Body() requestDto: UpdateAuctionRequest,
  ): Promise<UpdateAuctionResponse> {
    const command = UpdateAuctionWebMapper.toCommand(auctionUuid, requestDto);
    const response = await this.updateAuctionUseCase.execute(command, user);
    return UpdateAuctionWebMapper.fromResponse(response);
  }

  @Version('1')
  @Delete(':auctionUuid')
  @ApiBearerAuth()
  async deleteAuctionV1(@Param('auctionUuid') auctionUuid: string, @JwtUser() user: User): Promise<void> {
    await this.deleteAuctionUseCase.execute({ auctionUuid }, user);
  }

  @Version('1')
  @Post('/presigned-url')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PresignedUrlResponse })
  async presignedUrlV1(@JwtUser() user: User, @Body() requestDto: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    return await this.presignedUrlUseCase.execute(requestDto, user);
  }

  @Version('1')
  @Post(':auctionUuid/bidders')
  @ApiBearerAuth()
  async createAuctionBidderV1(
    @Param('auctionUuid') auctionUuid: string,
    @JwtUser() user: User,
    @Body() requestDto: CreateAuctionBidderRequest,
  ): Promise<void> {
    const command = CreateAuctionBidderWebMapper.toCommand(auctionUuid, requestDto, user);
    await this.createAuctionBidderUseCase.execute(command, user);
  }

  @Version('2')
  @Post(':auctionUuid/bidders')
  @ApiBearerAuth()
  async createAuctionBidderV2(
    @Param('auctionUuid') auctionUuid: string,
    @JwtUser() user: User,
    @Body() requestDto: CreateAuctionBidderRequest,
  ): Promise<void> {
    const command = CreateAuctionBidderKafkaWebMapper.toCommand(auctionUuid, requestDto, user);
    await this.createAuctionBidderKafkaUseCase.execute(command, user);
  }

  @Version('1')
  @Get(':auctionUuid/bidders')
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuctionBiddersResponse })
  async auctionBiddersV1(
    @Param('auctionUuid') auctionUuid: string,
    @Query() requestDto: AuctionBiddersRequest,
  ): Promise<AuctionBiddersResponse> {
    const command = AuctionBiddersWebMapper.toCommand(auctionUuid, requestDto);
    const response = await this.auctionBiddersUseCase.execute(command);
    return AuctionBiddersWebMapper.fromResponse(response);
  }

  @Version('1')
  @Post(':auctionUuid/complete')
  @ApiBearerAuth()
  async auctionSoldV1(@Param('auctionUuid') auctionUuid: string, @JwtUser() user: User): Promise<void> {
    const command = AuctionSoldWebMapper.toCommand(auctionUuid);
    await this.auctionSoldUseCase.execute(command, user);
  }
}
