export type AuctionAdminBidsCursor = {
  // Keep PostgreSQL microseconds intact instead of passing through a JavaScript Date.
  createdAt: string;
  auctionBidderUuid: string;
};

export type AuctionAdminBidsCommand = {
  auctionUuid: string;
  cursor?: AuctionAdminBidsCursor;
};
