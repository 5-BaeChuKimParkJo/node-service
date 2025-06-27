-- CreateTable
CREATE TABLE "AuctionViewed" (
    "auctionViewedId" BIGSERIAL NOT NULL,
    "auctionUuid" UUID NOT NULL,
    "viewerUuid" UUID NOT NULL,
    "viewedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionViewed_pkey" PRIMARY KEY ("auctionViewedId")
);
