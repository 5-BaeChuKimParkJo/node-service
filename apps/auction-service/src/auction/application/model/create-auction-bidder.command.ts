export type CreateAuctionBidderCommand = {
  auctionUuid: string;
  bidderUuid: string;
  bidAmount: bigint;
};
