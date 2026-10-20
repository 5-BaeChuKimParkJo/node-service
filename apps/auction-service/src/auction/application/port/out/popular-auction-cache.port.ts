import { PopularAuctionSnapshot } from '../../model/popular-auctions.result';

export abstract class PopularAuctionCachePort {
  abstract read(): Promise<PopularAuctionSnapshot | null>;
  abstract write(snapshot: PopularAuctionSnapshot): Promise<void>;
}
