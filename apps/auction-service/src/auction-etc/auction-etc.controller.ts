import { Controller, Get, Version } from '@nestjs/common';
import { AuctionEtcService } from './auction-etc.service';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { MyBidsResponseDto } from './dto/my-bids.dto';
import { AppException } from '@app/common/common/app.exception';
import * as TE from 'fp-ts/TaskEither';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import { JwtUser, User } from '@app/common';
import { MyBidsMapper } from './mapper/my-bids.mapper';

@Controller()
export class AuctionEtcController {
  constructor(private readonly auctionEtcService: AuctionEtcService) {}

  @Get('auctions/my-bids')
  @Version('1')
  @ApiBearerAuth()
  @ApiOkResponse({ type: [MyBidsResponseDto] })
  getMyBids(@JwtUser() user: User): TE.TaskEither<AppException, MyBidsResponseDto[]> {
    return F.pipe(this.auctionEtcService.getMyBids(user), TE.map(A.map(MyBidsMapper.toResponse)));
  }
}
