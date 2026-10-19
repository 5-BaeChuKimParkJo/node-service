export type AuctionsAdminCommand = {
  type: 'admin';
  query?: string;
  endingSoon?: boolean;
  status?: 'waiting' | 'active' | 'ended' | 'hidden' | 'cancelled';
  cursor?: {
    auctionUuid: string;
    createdAt: Date;
  };
};
