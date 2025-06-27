import { Body, Controller, Delete, Get, Param, Post, Put, Query, Version } from '@nestjs/common';
import { CreateAuctionUseCase } from '../../../application/port/in/create-auction.use-case';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { JwtUser, User } from '@app/common';
import { UpdateAuctionUseCase } from '../../../application/port/in/update-auction.use-case';
import { AuctionsUseCase } from '../../../application/port/in/auctions.use-case';
import { DeleteAuctionUseCase } from '../../../application/port/in/delete-auction.use-case';
import { AuctionsRequestDto, AuctionsResponseDto } from './dto/auctions.dto';
import { CreateAuctionRequestDto, CreateAuctionResponseDto } from './dto/create-auction.dto';
import { UpdateAuctionRequestDto, UpdateAuctionResponseDto } from './dto/update-auction.dto';
import { AuctionsDtoMapper } from './mapper/auctions-dto.mapper';
import { CreateAuctionDtoMapper } from './mapper/create-auction-dto.mapper';
import { UpdateAuctionDtoMapper } from './mapper/update-auction-dto.mapper';
import { PresignedUrlRequestDto, PresignedUrlResponseDto } from './dto/presigned-url.dto';
import { PresignedUrlUseCase } from '../../../application/port/in/presigned-url.use-case';
import { AuctionUseCase } from '../../../application/port/in/auction.use-case';
import { AuctionResponseDto } from './dto/auction.dto';
import { AuctionDtoMapper } from './mapper/auction-dto.mapper';
import { CreateAuctionBidderRequestDto } from './dto/create-auction-bidder.dto';
import { CreateAuctionBidderUseCase } from '../../../application/port/in/create-auction-bidder.use-case';
import { CreateAuctionBidderDtoMapper } from './mapper/create-auction-bidder-dto.mapper';
import { AuctionBiddersResponseDto } from './dto/auction-bidders.dto';
import { AuctionBiddersRequestDto } from './dto/auction-bidders.dto';
import { AuctionBiddersDtoMapper } from './mapper/auction-bidders-dto.mapper';
import { AuctionBiddersUseCase } from '../../../application/port/in/auction-bidders.use-case';
import { AuctionsByIdsItemResponseDto, AuctionsByIdsRequestDto } from './dto/auctions-by-ids.dto';
import { AuctionsByIdsUseCase } from '../../../application/port/in/auctions-by-ids.use-case';
import { AuctionsByIdsDtoMapper } from './mapper/auctions-by-ids-dto.mapper';
import { CreateAuctionBidderKafkaDtoMapper } from './mapper/create-auction-bidder-kafka-dto.mapper';
import { CreateAuctionBidderKafkaUseCase } from '../../../application/port/in/create-auction-bidder-kafka.use-case';
import { AuctionSoldUseCase } from '../../../application/port/in/auction-sold.use-case';
import { AuctionSoldDtoMapper } from './mapper/auction-sold-dto.mapper';

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
  @ApiOkResponse({ type: AuctionResponseDto })
  async auctionV1(@Param('auctionUuid') auctionUuid: string): Promise<AuctionResponseDto> {
    const command = AuctionDtoMapper.toCommand(auctionUuid);
    const response = await this.auctionUseCase.execute(command);
    return AuctionDtoMapper.fromResponse(response);
  }

  @Version('1')
  @Get()
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuctionsResponseDto })
  async auctionsV1(@Query() requestDto: AuctionsRequestDto): Promise<AuctionsResponseDto> {
    const command = AuctionsDtoMapper.toCommand(requestDto);
    const response = await this.auctionsUseCase.execute(command);
    return AuctionsDtoMapper.fromResponse(response);
  }

  @Version('1')
  @Post('/bulk')
  @ApiBearerAuth()
  @ApiOkResponse({ type: [AuctionsByIdsItemResponseDto] })
  async auctionsByIdsV1(@Body() requestDto: AuctionsByIdsRequestDto): Promise<AuctionsByIdsItemResponseDto[]> {
    const command = AuctionsByIdsDtoMapper.toCommand(requestDto);
    const response = await this.auctionsByIdsUseCase.execute(command);
    return AuctionsByIdsDtoMapper.fromResponse(response);
  }

  @Version('1')
  @Post()
  @ApiBearerAuth()
  @ApiOkResponse({ type: CreateAuctionResponseDto })
  async createAuctionV1(
    @JwtUser() user: User,
    @Body() requestDto: CreateAuctionRequestDto,
  ): Promise<CreateAuctionResponseDto> {
    const command = CreateAuctionDtoMapper.toCommand(requestDto);
    const response = await this.createAuctionUseCase.execute(command, user);
    return CreateAuctionDtoMapper.fromResponse(response);
  }

  @Version('1')
  @Put(':auctionUuid')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UpdateAuctionResponseDto })
  async updateAuctionV1(
    @Param('auctionUuid') auctionUuid: string,
    @JwtUser() user: User,
    @Body() requestDto: UpdateAuctionRequestDto,
  ): Promise<UpdateAuctionResponseDto> {
    const command = UpdateAuctionDtoMapper.toCommand(auctionUuid, requestDto);
    const response = await this.updateAuctionUseCase.execute(command, user);
    return UpdateAuctionDtoMapper.fromResponse(response);
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
  @ApiOkResponse({ type: PresignedUrlResponseDto })
  async presignedUrlV1(
    @JwtUser() user: User,
    @Body() requestDto: PresignedUrlRequestDto,
  ): Promise<PresignedUrlResponseDto> {
    return await this.presignedUrlUseCase.execute(requestDto, user);
  }

  @Version('1')
  @Post(':auctionUuid/bidders')
  @ApiBearerAuth()
  async createAuctionBidderV1(
    @Param('auctionUuid') auctionUuid: string,
    @JwtUser() user: User,
    @Body() requestDto: CreateAuctionBidderRequestDto,
  ): Promise<void> {
    const command = CreateAuctionBidderDtoMapper.toCommand(auctionUuid, requestDto, user);
    await this.createAuctionBidderUseCase.execute(command, user);
  }

  @Version('2')
  @Post(':auctionUuid/bidders')
  @ApiBearerAuth()
  async createAuctionBidderV2(
    @Param('auctionUuid') auctionUuid: string,
    @JwtUser() user: User,
    @Body() requestDto: CreateAuctionBidderRequestDto,
  ): Promise<void> {
    const command = CreateAuctionBidderKafkaDtoMapper.toCommand(auctionUuid, requestDto, user);
    await this.createAuctionBidderKafkaUseCase.execute(command, user);
  }

  @Version('1')
  @Get(':auctionUuid/bidders')
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuctionBiddersResponseDto })
  async auctionBiddersV1(
    @Param('auctionUuid') auctionUuid: string,
    @Query() requestDto: AuctionBiddersRequestDto,
  ): Promise<AuctionBiddersResponseDto> {
    const command = AuctionBiddersDtoMapper.toCommand(auctionUuid, requestDto);
    const response = await this.auctionBiddersUseCase.execute(command);
    return AuctionBiddersDtoMapper.fromResponse(response);
  }

  @Version('1')
  @Post(':auctionUuid/complete')
  @ApiBearerAuth()
  async auctionSoldV1(@Param('auctionUuid') auctionUuid: string, @JwtUser() user: User): Promise<void> {
    const command = AuctionSoldDtoMapper.toCommand(auctionUuid);
    const response = await this.auctionSoldUseCase.execute(command, user);
  }
}
