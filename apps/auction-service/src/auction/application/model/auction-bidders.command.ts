export type AuctionBiddersCommand = {
  auctionUuid: string;
  cursor?: {
    bidAmount: bigint;
    createdAt: Date;
  };
};
