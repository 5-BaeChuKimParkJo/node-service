import { MyBidsResponseDto } from '../dto/my-bids.dto';
import { MyBidsOutput } from '../schema/my-bids.schema';

export class MyBidsMapper {
  static toResponse = (output: MyBidsOutput): MyBidsResponseDto => {
    return {
      auction: {
        ...output.auction,
        minimumBid: Number(output.auction.minimumBid),
        currentBid: Number(output.auction.currentBid),
        version: output.auction.version,
      },
      bidder: {
        ...output.bidder,
        bidAmount: Number(output.bidder.bidAmount),
        createdAt: output.bidder.createdAt.toISOString(),
      },
    };
  };
}
