ALTER TABLE "Auctions" ADD COLUMN "demoTemplateUuid" UUID;

CREATE INDEX "Auctions_demoTemplateUuid_endAt_idx"
  ON "Auctions"("demoTemplateUuid", "endAt");
