import { AuctionAdminBidsCursor } from './auction-admin-bids.command';

export type AuctionAdminBidsResponse = {
  items: {
    auctionBidderUuid: string;
    bidderUuid: string;
    bidAmount: string;
    createdAt: string;
  }[];
  totalCount: number;
  nextCursor: AuctionAdminBidsCursor | null;
};
