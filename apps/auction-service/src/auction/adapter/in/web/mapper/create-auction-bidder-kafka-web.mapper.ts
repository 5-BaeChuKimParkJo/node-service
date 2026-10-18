import { User } from '@app/common/types/user';
import { CreateAuctionBidderRequest } from '../dto/create-auction-bidder.dto';
import { CreateAuctionBidderKafkaCommand } from '../../../../application/model/create-auction-bidder-kafka.command';

export class CreateAuctionBidderKafkaWebMapper {
  static toCommand = (
    auctionUuid: string,
    dto: CreateAuctionBidderRequest,
    user: User,
  ): CreateAuctionBidderKafkaCommand => {
    return {
      auctionUuid,
      bidderUuid: user.memberUuid,
      bidAmount: dto.bidAmount,
      createdAt: new Date(),
      requestId: dto.requestId,
    };
  };
}
