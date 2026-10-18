type AuctionBiddersNextCursorResult = {
  bidAmount: bigint;
  createdAt: Date;
};

type AuctionBiddersItemResult = {
  auctionUuid: string;
  bidderUuid: string;
  bidAmount: bigint;
  createdAt: Date;
};

export type AuctionBiddersResult = {
  items: AuctionBiddersItemResult[];
  nextCursor: AuctionBiddersNextCursorResult | null;
};
