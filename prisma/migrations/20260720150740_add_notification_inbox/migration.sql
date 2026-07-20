-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('ANNOUNCEMENT', 'TASK', 'ONBOARDING', 'ARTWORK', 'SYSTEM');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "tenantId" TEXT,
    "locationId" TEXT,
    "category" "NotificationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "entity" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_clerkUserId_readAt_createdAt_idx" ON "Notification"("clerkUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- CreateIndex
CREATE INDEX "Notification_locationId_idx" ON "Notification"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_clerkUserId_entity_entityId_category_key" ON "Notification"("clerkUserId", "entity", "entityId", "category");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
