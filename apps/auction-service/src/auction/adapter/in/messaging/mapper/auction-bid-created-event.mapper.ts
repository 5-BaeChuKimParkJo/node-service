import { AuctionBidCreatedEvent } from '../schema/auction-bidder-created.schema';
import { CreateAuctionBidderBatchCommand } from '../../../../application/model/create-auction-bidder-batch.command';

export class AuctionBidCreatedEventMapper {
  static toCommand = (dto: AuctionBidCreatedEvent): CreateAuctionBidderBatchCommand => {
    return {
      auctionUuid: dto.auctionUuid,
      bidderUuid: dto.bidderUuid,
      bidAmount: dto.bidAmount,
      createdAt: new Date(dto.createdAt),
      requestId: dto.requestId,
    };
  };
}
