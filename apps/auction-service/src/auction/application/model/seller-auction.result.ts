export interface SellerAuctionSnapshot {
  title: string;
  description: string;
  minimumBid: string;
  startAt: string;
  endAt: string;
  status: string;
}
export interface SellerAuctionResult extends SellerAuctionSnapshot {
  auctionUuid: string;
  version: number;
  editable: boolean;
  history: Array<{
    action: string;
    reasonCode: string | null;
    reasonDetail: string | null;
    before: SellerAuctionSnapshot;
    after: SellerAuctionSnapshot;
    createdAt: string;
  }>;
}
