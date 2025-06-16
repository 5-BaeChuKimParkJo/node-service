export type CreateAuctionBidderKafkaCommand = {
  auctionUuid: string;
  bidderUuid: string;
  bidAmount: number;
  createdAt: Date;
};
