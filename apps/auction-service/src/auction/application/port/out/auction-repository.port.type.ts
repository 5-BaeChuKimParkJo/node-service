import { Prisma } from 'apps/auction-service/src/prisma/generated';
import AuctionAdminDomain from '../../../domain/model/auction-admin.domain';
import AuctionBidderDomain from '../../../domain/model/auction-bidder.domain';
import AuctionDomain from '../../../domain/model/auction.domain';

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
