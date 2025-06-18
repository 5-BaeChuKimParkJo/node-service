export type CreateAuctionCommand = {
  categoryId?: number | null;
  directDealLocation?: string | null;
  description: string;
  startAt: Date;
  endAt: Date;
  isDirectDeal: boolean;
  productCondition: 'unopened' | 'new' | 'used';
  thumbnailKey: string;
  title: string;
  minimumBid: bigint;
  tagIds: number[];
  images: {
    key: string;
    order: number;
  }[];
};
