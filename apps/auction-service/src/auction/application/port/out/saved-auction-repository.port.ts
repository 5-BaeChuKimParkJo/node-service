import type { SavedAuctionPage } from '../../model/saved-auction.result';

export abstract class SavedAuctionRepositoryPort {
  abstract list(memberUuid: string, cursor: string | null): Promise<SavedAuctionPage>;
  abstract state(memberUuid: string, auctionUuid: string): Promise<boolean | null>;
  abstract save(memberUuid: string, auctionUuid: string): Promise<boolean>;
  abstract remove(memberUuid: string, auctionUuid: string): Promise<void>;
}
