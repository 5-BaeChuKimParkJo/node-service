type AuctionsImageResponse = {
  auctionImageId: bigint;
  url: string;
  order: number;
};

export type AuctionsByIdsAdminResponse = {
  auctionUuid: string;
  categoryId?: number | null;
  title: string;
  description: string;
  minimumBid: bigint;
  startAt: Date;
  endAt: Date;
  isDirectDeal: boolean;
  currentBidderUuid: string | null;
  directDealLocation?: string | null;
  status: 'waiting' | 'active' | 'ended' | 'hidden' | 'cancelled';
  productCondition: 'unopened' | 'new' | 'used';
  viewCount: bigint;
  thumbnailUrl: string;
  createdAt: Date;
  soldAt?: Date | null;
  sellerUuid: string;
  tagIds: number[];
  images: AuctionsImageResponse[];
}[];
