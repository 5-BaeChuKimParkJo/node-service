import { AuctionSoldCommand } from 'apps/auction-service/src/auction/application/port/dto/auction-sold.command';

export class AuctionSoldDtoMapper {
  static toCommand = (auctionUuid: string): AuctionSoldCommand => {
    return {
      auctionUuid,
    };
  };
}
