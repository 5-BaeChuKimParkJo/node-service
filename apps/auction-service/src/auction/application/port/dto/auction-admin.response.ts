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
  createdAt: string;
};

export type AuctionAdminDetailResponse = AuctionAdminResponse & {
  auditLogs: AuctionAdminAuditResponse[];
};
