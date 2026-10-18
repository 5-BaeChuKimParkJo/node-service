import { AuctionAdminBidsCursor } from './auction-admin-bids.command';

export type AuctionAdminBidsResult = {
  items: {
    auctionBidderUuid: string;
    bidderUuid: string;
    bidAmount: string;
    createdAt: string;
  }[];
  totalCount: number;
  nextCursor: AuctionAdminBidsCursor | null;
};
