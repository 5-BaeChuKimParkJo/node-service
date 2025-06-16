import { User } from '@app/common';
import { CreateAuctionBidderRequestDto } from '../dto/create-auction-bidder.dto';
import { CreateAuctionBidderKafkaCommand } from 'apps/auction-service/src/auction/application/port/dto/create-auction-bidder-kafka.command';

export class CreateAuctionBidderKafkaDtoMapper {
  static toCommand = (
    auctionUuid: string,
    dto: CreateAuctionBidderRequestDto,
    user: User,
  ): CreateAuctionBidderKafkaCommand => {
    return {
      auctionUuid,
      bidderUuid: user.memberUuid,
      bidAmount: dto.bidAmount,
      createdAt: new Date(),
    };
  };
}
