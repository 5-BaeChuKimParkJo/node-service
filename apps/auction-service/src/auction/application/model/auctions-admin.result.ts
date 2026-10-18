type AuctionsNextCursorResult = {
  createdAt: string;
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
  minimumBid: string;
  currentBid: string;
  startAt: string;
  endAt: string;
  isDirectDeal: boolean;
  directDealLocation?: string | null;
  status: 'waiting' | 'active' | 'ended' | 'hidden' | 'cancelled';
  visibility?: 'visible' | 'hidden' | 'cancelled';
  updatedAt?: string;
  deletedAt?: string | null;
  version?: number;
  productCondition: 'unopened' | 'new' | 'used';
  viewCount: bigint;
  thumbnailUrl: string;
  createdAt: string;
  soldAt?: string | null;
  sellerUuid: string;
  tagIds: number[];
  images: AuctionsImageResult[];
  currentBidderUuid: string | null;
};

export type AuctionsAdminResult = {
  items: AuctionsItemResult[];
  nextCursor: AuctionsNextCursorResult | null;
};
