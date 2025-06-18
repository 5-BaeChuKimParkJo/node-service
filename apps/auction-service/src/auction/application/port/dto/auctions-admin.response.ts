type AuctionsNextCursorResponse = {
  createdAt: Date;
  auctionUuid: string;
};

type AuctionsImageResponse = {
  auctionImageId: bigint;
  url: string;
  order: number;
};

type AuctionsItemResponse = {
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
  images: AuctionsImageResponse[];
};

export type AuctionsAdminResponse = {
  items: AuctionsItemResponse[];
  nextCursor: AuctionsNextCursorResponse | null;
};
