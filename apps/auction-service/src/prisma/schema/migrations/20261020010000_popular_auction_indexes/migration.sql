CREATE INDEX "AuctionViewed_viewedAt_auctionUuid_viewerUuid_idx"
ON "AuctionViewed" ("viewedAt", "auctionUuid", "viewerUuid");

CREATE INDEX "AuctionBidders_createdAt_auctionId_bidderUuid_idx"
ON "AuctionBidders" ("createdAt", "auctionId", "bidderUuid");
