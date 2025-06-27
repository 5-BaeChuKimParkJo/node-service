export abstract class AuctionCachePort {
  abstract increaseViewCount: (auctionUuid: string, count: number) => Promise<void>;
}
