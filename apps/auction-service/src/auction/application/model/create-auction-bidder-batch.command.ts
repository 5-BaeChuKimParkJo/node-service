export type CreateAuctionBidderBatchCommand = {
  auctionUuid: string;
  bidderUuid: string;
  bidAmount: number;
  createdAt: Date;
  requestId: string;
};
