export type CreateAuctionResponse = {
  auctionUuid: string;
  categoryId?: number | null;
  title: string;
  description: string;
  minimumBid: bigint;
  startAt: Date;
  endAt: Date;
  isDirectDeal: boolean;
  directDealLocation?: string | null;
  productCondition: 'unopened' | 'new' | 'used';
  status: 'waiting' | 'active' | 'ended' | 'hidden' | 'cancelled';
  viewCount: bigint;
  thumbnailUrl: string;
  createdAt: Date;
  sellerUuid: string;
  tagIds: number[];
  images: {
    auctionImageId: bigint;
    url: string;
    order: number;
  }[];
};
