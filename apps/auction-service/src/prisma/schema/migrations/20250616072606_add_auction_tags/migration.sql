-- CreateTable
CREATE TABLE "AuctionTags" (
    "auctionTagId" BIGSERIAL NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(6),
    "auctionId" BIGINT NOT NULL,

    CONSTRAINT "AuctionTags_pkey" PRIMARY KEY ("auctionTagId")
);

-- CreateIndex
CREATE INDEX "AuctionTags_auctionId_idx" ON "AuctionTags"("auctionId");

-- AddForeignKey
ALTER TABLE "AuctionTags" ADD CONSTRAINT "AuctionTags_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auctions"("auctionId") ON DELETE RESTRICT ON UPDATE CASCADE;
