export type PopularAuctionScore = {
  auctionUuid: string;
  uniqueViewers: string;
  uniqueBidders: string;
  score: string;
};

export type PopularAuctionSnapshot = {
  generatedAt: string;
  scores: PopularAuctionScore[];
};

export type PopularAuctionListing = {
  auctionUuid: string;
  title: string;
  thumbnailUrl: string;
  minimumBid: bigint;
  currentBid: bigint;
  startAt: Date;
  endAt: Date;
};

export type PopularAuctionsResult = {
  items: Array<
    PopularAuctionScore & {
      rank: number;
      title: string;
      thumbnailUrl: string;
      minimumBid: string;
      currentBid: string;
      startAt: string;
      endAt: string;
    }
  >;
  generatedAt: string;
  windowHours: 24;
};
