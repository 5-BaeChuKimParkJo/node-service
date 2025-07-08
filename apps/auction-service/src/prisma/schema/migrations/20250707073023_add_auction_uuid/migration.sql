-- AlterTable
ALTER TABLE "AuctionBidders" ADD COLUMN     "auctionUuid" UUID;

-- AlterTable
ALTER TABLE "AuctionImages" ADD COLUMN     "auctionUuid" UUID;

-- AlterTable
ALTER TABLE "AuctionViewed" ADD COLUMN     "auctionId" BIGINT;

-- CreateIndex
CREATE INDEX "AuctionBidders_auctionUuid_idx" ON "AuctionBidders"("auctionUuid");

-- CreateIndex
CREATE INDEX "AuctionImages_auctionUuid_idx" ON "AuctionImages"("auctionUuid");

-- CreateIndex
CREATE INDEX "AuctionViewed_auctionId_idx" ON "AuctionViewed"("auctionId");

-- CreateIndex
CREATE INDEX "AuctionViewed_auctionUuid_idx" ON "AuctionViewed"("auctionUuid");
