export type MySaleStatus = 'waiting' | 'active' | 'ended' | 'hidden' | 'cancelled';
export interface MySalesQuery {
  q: string;
  status: 'all' | MySaleStatus;
  sort: 'recent' | 'ending' | 'price';
  page: number;
}
export interface MySalesSummary {
  total: number;
  waiting: number;
  active: number;
  ended: number;
  hidden: number;
  cancelled: number;
}
export interface MySaleRecord {
  auctionUuid: string;
  title: string;
  thumbnailUrl: string;
  minimumBid: string;
  currentBid: string;
  bidCount: number;
  startAt: Date;
  endAt: Date;
  createdAt: Date;
  status: MySaleStatus;
}
export interface MySalesPageRecord {
  items: MySaleRecord[];
  summary: MySalesSummary;
  total: number;
}
export interface MySalesResult extends Omit<MySalesPageRecord, 'items'> {
  items: Array<
    Omit<MySaleRecord, 'startAt' | 'endAt' | 'createdAt'> & {
      startAt: string;
      endAt: string;
      createdAt: string;
    }
  >;
  page: number;
  pageSize: 20;
}
