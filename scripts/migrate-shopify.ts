/**
 * Idempotent Shopify → Kick Portal migration script (spec §23).
 *
 * Migrates, per tenant:
 *   - Products & variants (name, SKU, price -> integer cents, variant options)
 *   - Locations (if present in the export)
 *   - Optional historical orders, imported as FULFILLED with no payment/
 *     allowance/rebate side effects (reference only)
 *
 * Safe to re-run: every record is upserted by its Shopify external id
 * (Product.shopifyId, ProductVariant.shopifyId), so a second run against the
 * same export updates existing rows instead of duplicating them.
 *
 * Usage:
 *   npm run migrate-shopify -- --tenant=<tenantId> --input=./shopify-export.json [--dry-run] [--include-orders]
 *
 * Input format: a JSON file shaped like Shopify's Admin API product export
 * (see ShopifyExport type below) — produced by a separate one-off export
 * step (Shopify Admin CSV/API pull), not by this script.
 */
import { readFileSync } from "node:fs";
import { withTenant, systemKickContext } from "@/server/db/withTenant";
import { z } from "zod";

const shopifyVariantSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  price: z.union([z.string(), z.number()]), // Shopify prices are decimal strings, e.g. "19.99"
  sku: z.string().optional(),
  inventory_quantity: z.number().nullable().optional(),
});

const shopifyProductSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  variants: z.array(shopifyVariantSchema).min(1),
  status: z.string().optional(), // "active" | "draft" | "archived"
});

const shopifyLocationSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  address1: z.string().nullable().optional(),
});

const shopifyOrderLineSchema = z.object({
  variant_id: z.union([z.string(), z.number()]).nullable(),
  quantity: z.number(),
  price: z.union([z.string(), z.number()]),
});

const shopifyOrderSchema = z.object({
  id: z.union([z.string(), z.number()]),
  created_at: z.string(),
  location_id: z.union([z.string(), z.number()]).nullable().optional(),
  line_items: z.array(shopifyOrderLineSchema),
});

const shopifyExportSchema = z.object({
  products: z.array(shopifyProductSchema).default([]),
  locations: z.array(shopifyLocationSchema).default([]),
  orders: z.array(shopifyOrderSchema).default([]),
});

type ShopifyExport = z.infer<typeof shopifyExportSchema>;

type Args = { tenantId: string; inputPath: string; dryRun: boolean; includeOrders: boolean };

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string) => args.find((a) => a.startsWith(`--${flag}=`))?.split("=").slice(1).join("=");

  const tenantId = get("tenant");
  const inputPath = get("input");
  if (!tenantId || !inputPath) {
    throw new Error("Usage: migrate-shopify --tenant=<tenantId> --input=<path> [--dry-run] [--include-orders]");
  }
  return {
    tenantId,
    inputPath,
    dryRun: args.includes("--dry-run"),
    includeOrders: args.includes("--include-orders"),
  };
}

/** Shopify prices are decimal strings ("19.99") — convert to integer cents without floating point. */
export function dollarsToCents(price: string | number): number {
  const str = typeof price === "number" ? price.toFixed(2) : price;
  const [whole, fraction = "0"] = str.split(".");
  const cents = Number(whole) * 100 + Math.round(Number((fraction + "00").slice(0, 2)));
  if (!Number.isFinite(cents) || cents < 0) {
    throw new Error(`Invalid price value: ${price}`);
  }
  return cents;
}

type ValidationReport = {
  tenantId: string;
  dryRun: boolean;
  productsImported: number;
  productsSkipped: number;
  variantsImported: number;
  variantsSkipped: number;
  locationsImported: number;
  locationsSkipped: number;
  ordersImported: number;
  ordersSkipped: number;
  errors: string[];
};

async function main() {
  const { tenantId, inputPath, dryRun, includeOrders } = parseArgs();

  const raw = JSON.parse(readFileSync(inputPath, "utf-8"));
  const parsed = shopifyExportSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("❌ Invalid Shopify export format:", parsed.error.message);
    process.exit(1);
  }
  const data: ShopifyExport = parsed.data;

  const report: ValidationReport = {
    tenantId,
    dryRun,
    productsImported: 0,
    productsSkipped: 0,
    variantsImported: 0,
    variantsSkipped: 0,
    locationsImported: 0,
    locationsSkipped: 0,
    ordersImported: 0,
    ordersSkipped: 0,
    errors: [],
  };

  await withTenant(systemKickContext(), async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found. Create the tenant first via the Kick admin UI.`);
    }

    // --- Locations ---
    // Shopify locations map to franchisee Locations. Do NOT migrate payment
    // or pricing config here — locations are just name/address records.
    const shopifyLocationIdToInternal = new Map<string, string>();
    for (const loc of data.locations) {
      const shopifyId = String(loc.id);
      try {
        if (dryRun) {
          report.locationsImported++;
          continue;
        }
        // Locations have no shopifyId column in the schema (spec doesn't
        // require it) — match by name within the tenant to stay idempotent.
        const existing = await tx.location.findFirst({ where: { tenantId, name: loc.name } });
        const location = existing
          ? await tx.location.update({ where: { id: existing.id }, data: { address: loc.address1 ?? undefined } })
          : await tx.location.create({ data: { tenantId, name: loc.name, address: loc.address1 ?? null } });
        shopifyLocationIdToInternal.set(shopifyId, location.id);
        report.locationsImported++;
      } catch (err) {
        report.locationsSkipped++;
        report.errors.push(`Location ${shopifyId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // --- Products & variants ---
    const shopifyVariantIdToInternal = new Map<string, string>();
    for (const product of data.products) {
      const shopifyProductId = String(product.id);
      try {
        const sku = product.variants[0]?.sku || `SHOPIFY-${shopifyProductId}`;
        const active = product.status !== "archived" && product.status !== "draft";

        let internalProduct;
        if (dryRun) {
          report.productsImported++;
        } else {
          internalProduct = await tx.product.upsert({
            where: { tenantId_sku: { tenantId, sku } },
            create: { tenantId, name: product.title, sku, active, shopifyId: shopifyProductId },
            update: { name: product.title, active, shopifyId: shopifyProductId },
          });
          report.productsImported++;
        }

        for (const variant of product.variants) {
          const shopifyVariantId = String(variant.id);
          try {
            const priceCents = dollarsToCents(variant.price);
            if (dryRun) {
              report.variantsImported++;
              continue;
            }
            const existingVariant = await tx.productVariant.findFirst({ where: { shopifyId: shopifyVariantId } });
            const internalVariant = existingVariant
              ? await tx.productVariant.update({
                  where: { id: existingVariant.id },
                  data: { name: variant.title, priceCents, stock: variant.inventory_quantity ?? null },
                })
              : await tx.productVariant.create({
                  data: {
                    productId: internalProduct!.id,
                    name: variant.title,
                    priceCents,
                    stock: variant.inventory_quantity ?? null,
                    shopifyId: shopifyVariantId,
                  },
                });
            shopifyVariantIdToInternal.set(shopifyVariantId, internalVariant.id);
            report.variantsImported++;
          } catch (err) {
            report.variantsSkipped++;
            report.errors.push(`Variant ${shopifyVariantId} (product ${shopifyProductId}): ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } catch (err) {
        report.productsSkipped++;
        report.errors.push(`Product ${shopifyProductId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // --- Optional historical orders (reference only — never trigger payments/allowances/rebates) ---
    if (includeOrders) {
      for (const order of data.orders) {
        const shopifyOrderId = String(order.id);
        try {
          if (dryRun) {
            // Dry-run never populates the shopify-id -> internal-id maps
            // (no products/locations were actually written), so there's
            // nothing meaningful to resolve — just count the order as
            // "would be imported" without validating referential integrity.
            report.ordersImported++;
            continue;
          }

          const shopifyLocationId = order.location_id ? String(order.location_id) : null;
          const locationId = shopifyLocationId ? shopifyLocationIdToInternal.get(shopifyLocationId) : undefined;
          if (!locationId) {
            throw new Error(`No matching internal location for Shopify location ${shopifyLocationId}`);
          }

          const lines = order.line_items
            .filter((l) => l.variant_id !== null)
            .map((l) => {
              const internalVariantId = shopifyVariantIdToInternal.get(String(l.variant_id));
              if (!internalVariantId) throw new Error(`No matching internal variant for Shopify variant ${l.variant_id}`);
              return { variantId: internalVariantId, qty: l.quantity, unitPriceCents: dollarsToCents(l.price) };
            });
          const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0);

          const idempotencyKey = `shopify-import-${shopifyOrderId}`;
          const existing = await tx.order.findUnique({ where: { idempotencyKey } });
          if (existing) {
            report.ordersImported++; // already imported — idempotent no-op
            continue;
          }

          await tx.order.create({
            data: {
              tenantId,
              locationId,
              status: "FULFILLED",
              subtotalCents,
              allowanceAppliedCents: 0,
              cardChargedCents: 0,
              idempotencyKey,
              placedBy: "shopify-migration",
              createdAt: new Date(order.created_at),
              lines: { create: lines },
            },
          });
          report.ordersImported++;
        } catch (err) {
          report.ordersSkipped++;
          report.errors.push(`Order ${shopifyOrderId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  });

  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length > 0) {
    console.error(`\n⚠️  Completed with ${report.errors.length} error(s) — review before re-running.`);
    process.exit(1);
  }
  console.log(`\n✅ Migration ${dryRun ? "dry-run " : ""}complete for tenant ${tenantId}.`);
}

// Only run when executed directly (tsx scripts/migrate-shopify.ts ...), not
// when imported for unit testing dollarsToCents() etc.
if (process.argv[1]?.endsWith("migrate-shopify.ts") || process.argv[1]?.endsWith("migrate-shopify.js")) {
  main().catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });
}
