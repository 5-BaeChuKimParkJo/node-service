import AdminAuction from '../../../domain/model/admin-auction';
import AuctionBid from '../../../domain/model/auction-bid';
import Auction from '../../../domain/model/auction';
import { AuctionAdminAction } from '../../../domain/model/admin-auction';
import { AuctionAdminBidsCursor } from '../../model/auction-admin-bids.command';

export type DemoAuctionWriteResult =
  | { status: 'created'; auction: Auction }
  | { status: 'skipped-active' | 'skipped-busy' };

export type AdminAuctionBidRecord = {
  auctionBidderUuid: string;
  bidderUuid: string;
  bidAmount: bigint;
  createdAt: string;
};

export type AdminAuctionBidsReturn = {
  items: AdminAuctionBidRecord[];
  totalCount: number;
  nextCursor: AuctionAdminBidsCursor | null;
};

export type AuctionsArgs = {
  createdAt: Date;
  auctionUuid: string;
};

export type AuctionsReturn = {
  nextCursor: AuctionsArgs | null;
  items: Auction[];
};

export type AuctionsAdminReturn = {
  nextCursor: AuctionsArgs | null;
  items: AdminAuction[];
};

export type AuctionBiddersReturn = {
  nextCursor: {
    bidAmount: bigint;
    createdAt: Date;
  } | null;
  items: AuctionBid[];
};

export type AdminAuctionActionArgs = {
  auctionUuid: string;
  action: AuctionAdminAction;
  actor: string;
  reason: string;
  now?: Date;
};

export type AdminAuctionActionRecord = {
  auctionAdminActionId: string;
  actor: string;
  action: string;
  reason: string;
  previousStatus: string;
  nextStatus: string;
  createdAt: Date;
};
