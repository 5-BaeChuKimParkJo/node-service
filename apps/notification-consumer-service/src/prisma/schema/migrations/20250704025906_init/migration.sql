-- CreateTable
CREATE TABLE "Notification" (
    "notificationId" BIGSERIAL NOT NULL,
    "memberUuid" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("notificationId")
);

-- CreateIndex
CREATE INDEX "Notification_memberUuid_createdAt_idx" ON "Notification"("memberUuid", "createdAt");
