import { User } from '@app/common';
import { CreateAuctionBidderRequestDto } from '../dto/create-auction-bidder.dto';
import { CreateAuctionBidderCommand } from 'apps/auction-service/src/auction/application/port/dto/create-auction-bidder.command';

export class CreateAuctionBidderDtoMapper {
  static toCommand = (
    auctionUuid: string,
    dto: CreateAuctionBidderRequestDto,
    user: User,
  ): CreateAuctionBidderCommand => {
    return {
      auctionUuid,
      bidderUuid: user.memberUuid,
      bidAmount: BigInt(dto.bidAmount),
    };
  };
}
