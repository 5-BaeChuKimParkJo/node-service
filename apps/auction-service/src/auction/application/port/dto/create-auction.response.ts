export type CreateAuctionResponse = {
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
  productCondition: 'unopened' | 'new' | 'used';
  status: 'waiting' | 'active' | 'ended' | 'hidden' | 'cancelled';
  viewCount: bigint;
  thumbnailUrl: string;
  createdAt: Date;
  soldAt?: Date | null;
  sellerUuid: string;
  tagIds: number[];
  tagNames: string[];
  images: {
    auctionImageId: bigint;
    url: string;
    order: number;
  }[];
};
