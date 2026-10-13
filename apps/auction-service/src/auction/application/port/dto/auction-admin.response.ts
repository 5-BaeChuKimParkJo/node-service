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
  minimumBid: string;
  currentBid: string;
  startAt: Date;
  endAt: Date;
  isDirectDeal: boolean;
  directDealLocation?: string | null;
  status: 'waiting' | 'active' | 'ended' | 'hidden' | 'cancelled';
  productCondition: 'unopened' | 'new' | 'used';
  viewCount: bigint;
  thumbnailUrl: string;
  createdAt: Date;
  soldAt?: Date | null;
  sellerUuid: string;
  tagIds: number[];
  currentBidderUuid: string | null;
  images: AuctionImageResponse[];
};

export type AuctionAdminAuditResponse = {
  auctionAdminActionId: string;
  actor: string;
  action: string;
  reason: string;
  previousStatus: string;
  nextStatus: string;
  createdAt: Date;
};

export type AuctionAdminDetailResponse = AuctionAdminResponse & {
  auditLogs: AuctionAdminAuditResponse[];
};
