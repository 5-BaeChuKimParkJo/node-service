export interface SavedAuctionRecord {
  auctionUuid: string;
  title: string;
  thumbnailUrl: string;
  minimumBid: string;
  currentBid: string;
  startAt: Date;
  endAt: Date;
  savedAt: Date;
}

export interface SavedAuctionPage {
  items: SavedAuctionRecord[];
  nextCursor: string | null;
}

export interface SavedAuctionListResult {
  items: Array<
    Omit<SavedAuctionRecord, 'startAt' | 'endAt' | 'savedAt'> & {
      startAt: string;
      endAt: string;
      savedAt: string;
      status: 'waiting' | 'active' | 'ended';
    }
  >;
  nextCursor: string | null;
}
