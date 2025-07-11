import { AuctionServiceBidderCreatedDto } from '../schema/auction-bidder-created.schema';
import { CreateAuctionBidderBatchCommand } from 'apps/auction-service/src/auction/application/port/dto/create-auction-bidder-batch.command';

export class AuctionServiceBidderCreatedDtoMapper {
  static toCommand = (dto: AuctionServiceBidderCreatedDto): CreateAuctionBidderBatchCommand => {
    return {
      auctionUuid: dto.auctionUuid,
      bidderUuid: dto.bidderUuid,
      bidAmount: dto.bidAmount,
      createdAt: new Date(dto.createdAt),
      requestId: dto.requestId,
    };
  };
}
