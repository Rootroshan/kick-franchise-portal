-- AlterEnum: fulfilment lifecycle states. Existing rows keep their current
-- values; FULFILLED remains valid (legacy, displayed as Delivered).
ALTER TYPE "OrderStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "OrderStatus" ADD VALUE 'SHIPPED';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';

-- AlterEnum: order lifecycle notifications for store users.
ALTER TYPE "NotificationCategory" ADD VALUE 'ORDER';

-- Customer-facing sequential order number. SERIAL backfills existing rows in
-- insertion order; the sequence is then bumped so new orders start at >= 1001
-- (four digits reads as a "real" order number, and never collides with backfill).
ALTER TABLE "Order" ADD COLUMN "orderNumber" SERIAL;
SELECT setval(
  pg_get_serial_sequence('"Order"', 'orderNumber'),
  GREATEST((SELECT COALESCE(MAX("orderNumber"), 0) FROM "Order"), 1000)
);
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- Lifecycle timestamps + shipment data + cancellation request.
ALTER TABLE "Order"
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "processingAt" TIMESTAMP(3),
  ADD COLUMN "shippedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "estimatedDeliveryAt" TIMESTAMP(3),
  ADD COLUMN "carrier" TEXT,
  ADD COLUMN "trackingNumber" TEXT,
  ADD COLUMN "cancellationRequestedAt" TIMESTAMP(3),
  ADD COLUMN "cancellationRequestedBy" TEXT,
  ADD COLUMN "cancellationReason" TEXT;

-- Honest backfill: rows that are already PAID/FULFILLED predate per-step
-- timestamps; stamp paidAt from updatedAt only where the payment demonstrably
-- happened (status says so), never inventing shipping events.
UPDATE "Order" SET "paidAt" = "updatedAt" WHERE "status" IN ('PAID', 'FULFILLED') AND "paidAt" IS NULL;

-- List queries sort a location's orders by recency.
CREATE INDEX "Order_locationId_createdAt_idx" ON "Order"("locationId", "createdAt");
