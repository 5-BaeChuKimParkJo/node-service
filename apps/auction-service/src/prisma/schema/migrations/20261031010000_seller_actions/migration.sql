CREATE TABLE "AuctionSellerAction" (
  "actionUuid" UUID NOT NULL,
  "auctionUuid" UUID NOT NULL,
  "sellerUuid" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "reasonCode" TEXT,
  "reasonDetail" TEXT,
  "beforeSnapshot" JSONB NOT NULL,
  "afterSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuctionSellerAction_pkey" PRIMARY KEY ("actionUuid"),
  CONSTRAINT "AuctionSellerAction_auctionUuid_fkey" FOREIGN KEY ("auctionUuid") REFERENCES "Auctions"("auctionUuid") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AuctionSellerAction_auctionUuid_createdAt_idx" ON "AuctionSellerAction"("auctionUuid", "createdAt");
