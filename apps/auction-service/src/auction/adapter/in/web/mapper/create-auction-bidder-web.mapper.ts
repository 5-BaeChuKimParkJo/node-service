import { User } from '@app/common/types/user';
import { CreateAuctionBidderRequest } from '../dto/create-auction-bidder.dto';
import { CreateAuctionBidderCommand } from '../../../../application/model/create-auction-bidder.command';

export class CreateAuctionBidderWebMapper {
  static toCommand = (auctionUuid: string, dto: CreateAuctionBidderRequest, user: User): CreateAuctionBidderCommand => {
    return {
      auctionUuid,
      bidderUuid: user.memberUuid,
      bidAmount: BigInt(dto.bidAmount),
    };
  };
}
