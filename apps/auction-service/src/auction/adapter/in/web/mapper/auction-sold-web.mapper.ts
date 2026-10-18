import { AuctionSoldCommand } from '../../../../application/model/auction-sold.command';

export class AuctionSoldWebMapper {
  static toCommand = (auctionUuid: string): AuctionSoldCommand => {
    return {
      auctionUuid,
    };
  };
}
