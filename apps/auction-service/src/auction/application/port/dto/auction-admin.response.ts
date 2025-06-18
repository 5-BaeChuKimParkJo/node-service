type AuctionImageResponse = {
  auctionImageId: bigint;
  url: string;
  order: number;
};

export type AuctionAdminResponse = {
  auctionUuid: string;
  categoryId?: number | null;
  title: string;
  description: string;
  minimumBid: bigint;
  startAt: Date;
  endAt: Date;
  isDirectDeal: boolean;
  directDealLocation?: string | null;
  status: 'waiting' | 'active' | 'ended' | 'hidden' | 'cancelled';
  productCondition: 'unopened' | 'new' | 'used';
  viewCount: bigint;
  thumbnailUrl: string;
  createdAt: Date;
  sellerUuid: string;
  tagIds: number[];
  images: AuctionImageResponse[];
};
