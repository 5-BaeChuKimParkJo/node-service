import { CatalogAuctionResponseDto } from '../dto/auction-dto';
import { Auction } from '../schema/auction.schema';

export class AuctionMapper {
  static toResponseDto = (auction: Auction): CatalogAuctionResponseDto => {
    return {
      ...auction,
      startAt: auction.startAt.toISOString(),
      endAt: auction.endAt.toISOString(),
      createdAt: auction.createdAt.toISOString(),
    };
  };
}
