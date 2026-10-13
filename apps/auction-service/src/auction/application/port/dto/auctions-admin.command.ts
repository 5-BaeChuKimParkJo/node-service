export type AuctionsAdminCommand = {
  type: 'admin';
  query?: string;
  status?: 'waiting' | 'active' | 'ended' | 'hidden' | 'cancelled';
  cursor?: {
    auctionUuid: string;
    createdAt: Date;
  };
};
