/*
  Warnings:

  - You are about to drop the `AuctionTags` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AuctionTags" DROP CONSTRAINT "AuctionTags_auctionId_fkey";

-- AlterTable
ALTER TABLE "Auctions" ADD COLUMN     "tagIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- DropTable
DROP TABLE "AuctionTags";
