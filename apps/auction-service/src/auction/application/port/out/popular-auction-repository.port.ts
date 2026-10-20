import { PopularAuctionListing, PopularAuctionScore } from '../../model/popular-auctions.result';

export abstract class PopularAuctionRepositoryPort {
  abstract rank(now: Date): Promise<PopularAuctionScore[]>;
  abstract findActive(auctionUuids: string[], now: Date): Promise<PopularAuctionListing[]>;
  abstract recordView(command: { auctionUuid: string; viewerUuid: string }, now: Date): Promise<void>;
}
