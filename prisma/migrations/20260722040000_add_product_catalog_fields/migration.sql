-- Store-facing catalog metadata (category filter, detail description, card image)
ALTER TABLE "Product" ADD COLUMN "category" TEXT;
ALTER TABLE "Product" ADD COLUMN "description" TEXT;
ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;

-- Catalog reads always filter tenantId + active (and often category)
CREATE INDEX "Product_tenantId_active_category_idx" ON "Product"("tenantId", "active", "category");
