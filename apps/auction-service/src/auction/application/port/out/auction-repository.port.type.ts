import { Prisma } from 'apps/auction-service/src/prisma/generated';
import AuctionAdminDomain from '../../../domain/model/auction-admin.domain';
import AuctionBidderDomain from '../../../domain/model/auction-bidder.domain';
import AuctionDomain from '../../../domain/model/auction.domain';
import { AuctionAdminAction } from '../../../domain/model/auction-admin.domain';

export type AuctionsArgs = {
  createdAt: Date;
  auctionUuid: string;
};

export type AuctionsReturn = {
  nextCursor: AuctionsArgs | null;
  items: AuctionDomain[];
};

export type AuctionsAdminReturn = {
  nextCursor: AuctionsArgs | null;
  items: AuctionAdminDomain[];
};

export type AuctionBiddersReturn = {
  nextCursor: {
    bidAmount: bigint;
    createdAt: Date;
  } | null;
  items: AuctionBidderDomain[];
};

export type Auctions = Prisma.AuctionsGetPayload<{}>;

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
