import AdminAuction from '../../../domain/model/admin-auction';
import NewBidBatch from '../../../domain/model/new-bid-batch';
import NewBid from '../../../domain/model/new-bid';
import AuctionBid from '../../../domain/model/auction-bid';
import NewAuction from '../../../domain/model/new-auction';
import AuctionDeletion from '../../../domain/model/auction-deletion';
import AuctionUpdate from '../../../domain/model/auction-update';
import AuctionViewBatch from '../../../domain/model/auction-view-batch';
import Auction from '../../../domain/model/auction';
import { AuctionAdminCommand } from '../../model/auction-admin.command';
import { AuctionAdminBidsCommand } from '../../model/auction-admin-bids.command';
import { AuctionBiddersCommand } from '../../model/auction-bidders.command';
import { AuctionCommand } from '../../model/auction.command';
import { AuctionsAdminCommand } from '../../model/auctions-admin.command';
import { AuctionsByIdsAdminCommand } from '../../model/auctions-by-ids-admin.command';
import { AuctionsByIdsCommand } from '../../model/auctions-by-ids.command';
import { AuctionsCommand } from '../../model/auctions.command';
import { DemoAuctionCreationCommand } from '../../model/demo-auction-creation.command';
import {
  AdminAuctionActionArgs,
  AdminAuctionActionRecord,
  AdminAuctionBidsReturn,
  AuctionBiddersReturn,
  AuctionsAdminReturn,
  AuctionsReturn,
  DemoAuctionWriteResult,
} from './auction-repository.port.type';
export type AuctionBidSession = {
  auction: Auction;
  createBid(bidder: NewBid): Promise<void>;
  createBids(bidders: NewBidBatch): Promise<void>;
  updateCurrent(amount: bigint, bidderUuid: string): Promise<void>;
  updateCurrentBid(amount: bigint, bidderUuid: string): Promise<number>;
};

export abstract class AuctionRepositoryPort {
  abstract withLockedAuction<T>(auctionUuid: string, work: (session: AuctionBidSession) => Promise<T>): Promise<T>;

  abstract findAuction(args: AuctionCommand): Promise<Auction>;
  abstract findAuction(args: AuctionAdminCommand): Promise<AdminAuction>;

  abstract findAuctions(args: AuctionsCommand): Promise<AuctionsReturn>;
  abstract findAuctions(args: AuctionsAdminCommand): Promise<AuctionsAdminReturn>;

  abstract findAuctionsByIds(args: AuctionsByIdsCommand): Promise<Auction[]>;
  abstract findAuctionsByIds(args: AuctionsByIdsAdminCommand): Promise<AdminAuction[]>;

  abstract createAuction: (auctionForCreate: NewAuction) => Promise<Auction>;
  abstract createDemoAuction: (
    auction: NewAuction,
    context: DemoAuctionCreationCommand,
  ) => Promise<DemoAuctionWriteResult>;

  abstract updateAuction: (auctionForUpdate: AuctionUpdate) => Promise<Auction>;
  abstract updateAuctionCurrent: (auctionUuid: string, currentBid: bigint, currentBidderUuid: string) => Promise<void>;

  abstract deleteAuction: (auctionForDelete: AuctionDeletion) => Promise<void>;

  abstract findHighestBidder: (auctionUuid: string) => Promise<AuctionBid | undefined>;

  abstract createAuctionBidder: (auctionBidder: NewBid) => Promise<void>;
  abstract createAuctionBidders: (auctionBidder: NewBidBatch) => Promise<void>;

  abstract updateAuctionCurrentBid: (auctionUuid: string, bidAmount: bigint, bidderUuid: string) => Promise<number>;

  abstract findAuctionBidders: (args: AuctionBiddersCommand) => Promise<AuctionBiddersReturn>;

  abstract createAuctionViewedBulk: (auctionViewed: AuctionViewBatch) => Promise<void>;

  abstract applyAdminAction: (args: AdminAuctionActionArgs) => Promise<AdminAuction>;
  abstract findAdminActions: (auctionUuid: string) => Promise<AdminAuctionActionRecord[]>;
  abstract findAdminBids: (args: AuctionAdminBidsCommand) => Promise<AdminAuctionBidsReturn>;
}
