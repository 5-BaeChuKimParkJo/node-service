import AuctionBid from '../../domain/model/auction-bid';
import { AuctionBiddersResult } from '../model/auction-bidders.result';

export class AuctionBidderMapper {
  toResponse = (auctionBidder: AuctionBid): AuctionBiddersResult['items'][number] => {
    const snapshot = auctionBidder.getSnapshot();

    return {
      auctionUuid: snapshot.auctionUuid,
      bidderUuid: snapshot.bidderUuid,
      bidAmount: snapshot.bidAmount,
      createdAt: snapshot.createdAt,
    };
  };
}
