type AuctionImageResponse = {
  auctionImageId: bigint;
  url: string;
  order: number;
};

export type AuctionResponse = {
  auctionUuid: string;
  categoryId?: number | null;
  categoryName: string | null;
  title: string;
  description: string;
  minimumBid: bigint;
  startAt: Date;
  endAt: Date;
  isDirectDeal: boolean;
  directDealLocation?: string | null;
  currentBidderUuid: string | null;
  status: 'waiting' | 'active' | 'ended';
  productCondition: 'unopened' | 'new' | 'used';
  viewCount: bigint;
  thumbnailUrl: string;
  createdAt: Date;
  soldAt?: Date | null;
  sellerUuid: string;
  tagIds: number[];
  tagNames: string[];
  images: AuctionImageResponse[];
};
