CREATE TABLE "SavedAuction" (
    "savedId" BIGSERIAL PRIMARY KEY,
    "memberUuid" UUID NOT NULL,
    "auctionUuid" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedAuction_auctionUuid_fkey" FOREIGN KEY ("auctionUuid")
      REFERENCES "Auctions"("auctionUuid") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SavedAuction_memberUuid_auctionUuid_key" ON "SavedAuction"("memberUuid","auctionUuid");
CREATE INDEX "SavedAuction_memberUuid_savedId_idx" ON "SavedAuction"("memberUuid","savedId");
