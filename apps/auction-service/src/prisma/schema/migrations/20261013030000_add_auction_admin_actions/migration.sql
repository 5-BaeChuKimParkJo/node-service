CREATE TABLE "AuctionAdminActions" (
    "auctionAdminActionId" UUID NOT NULL,
    "auctionUuid" UUID NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "nextStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionAdminActions_pkey" PRIMARY KEY ("auctionAdminActionId")
);

CREATE INDEX "AuctionAdminActions_auctionUuid_createdAt_idx"
    ON "AuctionAdminActions"("auctionUuid", "createdAt");
