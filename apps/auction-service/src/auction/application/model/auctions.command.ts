export type AuctionsCommand = {
  type: 'user';
  cursor?: {
    auctionUuid: string;
    createdAt: Date;
  };
};
