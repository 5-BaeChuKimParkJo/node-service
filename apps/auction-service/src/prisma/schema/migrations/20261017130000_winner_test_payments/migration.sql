ALTER TABLE "Auctions" ADD COLUMN "checkoutLockedAt" TIMESTAMPTZ(6);

CREATE TYPE "AuctionPurchaseStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'CANCELED');
CREATE TYPE "AuctionPaymentAttemptStatus" AS ENUM ('READY', 'CONFIRMING', 'UNKNOWN', 'WAITING_FOR_DEPOSIT', 'DONE', 'CANCELING', 'CANCELED', 'ABORTED', 'EXPIRED');

CREATE TABLE "AuctionPurchase" (
  "purchaseUuid" UUID NOT NULL,
  "auctionUuid" UUID NOT NULL,
  "buyerUuid" UUID NOT NULL,
  "sellerUuid" UUID NOT NULL,
  "amount" BIGINT NOT NULL CHECK ("amount" > 0),
  "orderName" TEXT NOT NULL,
  "customerKey" UUID NOT NULL,
  "status" "AuctionPurchaseStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
  "paidAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "AuctionPurchase_pkey" PRIMARY KEY ("purchaseUuid"),
  CONSTRAINT "AuctionPurchase_auctionUuid_fkey" FOREIGN KEY ("auctionUuid") REFERENCES "Auctions"("auctionUuid") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AuctionPurchase_auctionUuid_key" ON "AuctionPurchase"("auctionUuid");
CREATE UNIQUE INDEX "AuctionPurchase_customerKey_key" ON "AuctionPurchase"("customerKey");

CREATE TABLE "AuctionPaymentAttempt" (
  "orderId" TEXT NOT NULL,
  "purchaseUuid" UUID NOT NULL,
  "attemptNumber" INTEGER NOT NULL CHECK ("attemptNumber" > 0),
  "paymentKey" TEXT,
  "confirmIdempotencyKey" UUID NOT NULL,
  "cancelIdempotencyKey" UUID NOT NULL,
  "status" "AuctionPaymentAttemptStatus" NOT NULL DEFAULT 'READY',
  "method" TEXT,
  "approvedAt" TIMESTAMPTZ(6),
  "confirmRequestedAt" TIMESTAMPTZ(6),
  "cancelRequestedAt" TIMESTAMPTZ(6),
  "operationLeaseUntil" TIMESTAMPTZ(6),
  "operationLeaseToken" UUID,
  "cancelReason" TEXT,
  "cancelActor" TEXT,
  "errorCode" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "AuctionPaymentAttempt_pkey" PRIMARY KEY ("orderId"),
  CONSTRAINT "AuctionPaymentAttempt_purchaseUuid_fkey" FOREIGN KEY ("purchaseUuid") REFERENCES "AuctionPurchase"("purchaseUuid") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AuctionPaymentAttempt_paymentKey_key" ON "AuctionPaymentAttempt"("paymentKey");
CREATE UNIQUE INDEX "AuctionPaymentAttempt_confirmIdempotencyKey_key" ON "AuctionPaymentAttempt"("confirmIdempotencyKey");
CREATE UNIQUE INDEX "AuctionPaymentAttempt_cancelIdempotencyKey_key" ON "AuctionPaymentAttempt"("cancelIdempotencyKey");
CREATE UNIQUE INDEX "AuctionPaymentAttempt_purchaseUuid_attemptNumber_key" ON "AuctionPaymentAttempt"("purchaseUuid", "attemptNumber");
