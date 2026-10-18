type AuctionsNextCursorResult = {
  createdAt: Date;
  auctionUuid: string;
};

type AuctionsImageResult = {
  auctionImageId: bigint;
  url: string;
  order: number;
};

type AuctionsItemResult = {
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
  status: 'waiting' | 'active' | 'ended';
  productCondition: 'unopened' | 'new' | 'used';
  viewCount: bigint;
  thumbnailUrl: string;
  createdAt: Date;
  soldAt?: Date | null;
  sellerUuid: string;
  tagIds: number[];
  images: AuctionsImageResult[];
};

export type AuctionsResult = {
  items: AuctionsItemResult[];
  nextCursor: AuctionsNextCursorResult | null;
};
