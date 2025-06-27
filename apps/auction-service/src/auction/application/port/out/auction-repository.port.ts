import AuctionAdminDomain from '../../../domain/model/auction-admin.domain';
import AuctionBidderForCreateBulkDomain from '../../../domain/model/auction-bidder-for-create-bulk.domain';
import AuctionBidderForCreateDomain from '../../../domain/model/auction-bidder-for-create.domain';
import AuctionBidderDomain from '../../../domain/model/auction-bidder.domain';
import AuctionForCreateDomain from '../../../domain/model/auction-for-create.domain';
import AuctionForDeleteDomain from '../../../domain/model/auction-for-delete.domain';
import AuctionForUpdateDomain from '../../../domain/model/auction-for-update.domain';
import AuctionViewedForCreateBulkDomain from '../../../domain/model/auction-viewed-for-create-bulk.domain';
import AuctionDomain from '../../../domain/model/auction.domain';
import { AuctionAdminCommand } from '../dto/auction-admin.command';
import { AuctionBiddersCommand } from '../dto/auction-bidders.command';
import { AuctionCommand } from '../dto/auction.command';
import { AuctionsAdminCommand } from '../dto/auctions-admin.command';
import { AuctionsByIdsAdminCommand } from '../dto/auctions-by-ids-admin.command';
import { AuctionsByIdsCommand } from '../dto/auctions-by-ids.command';
import { AuctionsCommand } from '../dto/auctions.command';
import { AuctionBiddersReturn, AuctionsAdminReturn, AuctionsReturn } from './auction-repository.port.type';
import { Prisma } from 'apps/auction-service/src/prisma/generated';

export type TX = Prisma.TransactionClient;

export abstract class AuctionRepositoryPort {
  abstract transaction: <T>(
    fn: (tx: TX) => Promise<T>,
    args?: {
      isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
      maxWait?: number;
      timeout?: number;
    },
  ) => Promise<T>;

  abstract findAuction(args: AuctionCommand): Promise<AuctionDomain>;
  abstract findAuction(args: AuctionAdminCommand): Promise<AuctionAdminDomain>;
  abstract findAcutionForUpdate: (auctionUuid: string, tx?: TX) => Promise<AuctionDomain>;

  abstract findAuctions(args: AuctionsCommand): Promise<AuctionsReturn>;
  abstract findAuctions(args: AuctionsAdminCommand): Promise<AuctionsAdminReturn>;

  abstract findAuctionsByIds(args: AuctionsByIdsCommand): Promise<AuctionDomain[]>;
  abstract findAuctionsByIds(args: AuctionsByIdsAdminCommand): Promise<AuctionAdminDomain[]>;

  abstract createAuction: (auctionForCreate: AuctionForCreateDomain) => Promise<AuctionDomain>;

  abstract updateAuction: (auctionForUpdate: AuctionForUpdateDomain) => Promise<AuctionDomain>;
  abstract updateAuctionCurrent: (
    auctionUuid: string,
    currentBid: bigint,
    currentBidderUuid: string,
    tx?: TX,
  ) => Promise<void>;

  abstract deleteAuction: (auctionForDelete: AuctionForDeleteDomain) => Promise<void>;

  abstract findHighestBidder: (auctionUuid: string) => Promise<AuctionBidderDomain | undefined>;

  abstract createAuctionBidder: (auctionBidder: AuctionBidderForCreateDomain, tx?: TX) => Promise<void>;
  abstract createAuctionBidders: (auctionBidder: AuctionBidderForCreateBulkDomain, tx?: TX) => Promise<void>;

  abstract updateAuctionCurrentBid: (
    auctionUuid: string,
    bidAmount: bigint,
    bidderUuid: string,
    tx?: TX,
  ) => Promise<number>;

  abstract findAuctionBidders: (args: AuctionBiddersCommand) => Promise<AuctionBiddersReturn>;

  abstract createAuctionViewedBulk: (auctionViewed: AuctionViewedForCreateBulkDomain) => Promise<void>;
}
