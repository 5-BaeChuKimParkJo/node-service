/*
  Warnings:

  - You are about to drop the column `auctionUuid` on the `AuctionBidders` table. All the data in the column will be lost.
  - You are about to drop the column `auctionUuid` on the `AuctionImages` table. All the data in the column will be lost.
  - You are about to drop the column `auctionId` on the `AuctionViewed` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "AuctionBidders_auctionUuid_idx";

-- DropIndex
DROP INDEX "AuctionImages_auctionUuid_idx";

-- DropIndex
DROP INDEX "AuctionViewed_auctionId_idx";

-- DropIndex
DROP INDEX "AuctionViewed_auctionUuid_idx";

-- AlterTable
ALTER TABLE "AuctionBidders" DROP COLUMN "auctionUuid";

-- AlterTable
ALTER TABLE "AuctionImages" DROP COLUMN "auctionUuid";

-- AlterTable
ALTER TABLE "AuctionViewed" DROP COLUMN "auctionId";
