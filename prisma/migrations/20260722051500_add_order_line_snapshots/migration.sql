-- Order line display snapshots (product/variant name, SKU, image at order
-- time). Store User order history must keep rendering correctly after a
-- product is deactivated or edited — franchisee RLS (product_read/variant_read)
-- only shows ACTIVE catalog rows, so a plain join through Product/ProductVariant
-- silently breaks the moment a product is deactivated. These columns are
-- snapshots, independent of RLS.
ALTER TABLE "OrderLine"
  ADD COLUMN "productName" TEXT,
  ADD COLUMN "variantName" TEXT,
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "imageUrl" TEXT;

-- Backfill existing rows from the current catalog (best-effort — this is the
-- only data available for historical orders; going forward, checkout writes
-- these directly). Runs as the schema owner, unaffected by RLS.
UPDATE "OrderLine" ol
SET "productName" = p.name, "variantName" = v.name, "sku" = p.sku, "imageUrl" = p."imageUrl"
FROM "ProductVariant" v
JOIN "Product" p ON p.id = v."productId"
WHERE v.id = ol."variantId";
