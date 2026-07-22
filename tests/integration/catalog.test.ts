import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { getCatalogForLocation } from "@/server/modules/commerce/products";
import { kickCtx, franchiseeCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";

async function seedProduct(
  tenantId: string,
  opts: { name: string; sku: string; category?: string | null; active?: boolean; variants?: Array<{ priceCents: number; active?: boolean }> }
) {
  return withTenant(kickCtx(), async (tx) => {
    const product = await tx.product.create({
      data: {
        tenantId,
        name: opts.name,
        sku: opts.sku,
        category: opts.category ?? null,
        active: opts.active ?? true,
      },
    });
    for (const [i, v] of (opts.variants ?? []).entries()) {
      await tx.productVariant.create({
        data: { productId: product.id, name: `V${i}`, priceCents: v.priceCents, active: v.active ?? true },
      });
    }
    return product;
  });
}

describe("Store catalog visibility and filtering", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("shows only active products with at least one active variant", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    await seedProduct(tenant.id, { name: "Orderable", sku: "OK-1", variants: [{ priceCents: 1000 }] });
    await seedProduct(tenant.id, { name: "No variants", sku: "NOVAR-1" });
    await seedProduct(tenant.id, { name: "Only inactive variant", sku: "INVAR-1", variants: [{ priceCents: 900, active: false }] });
    await seedProduct(tenant.id, { name: "Inactive product", sku: "OFF-1", active: false, variants: [{ priceCents: 800 }] });

    const ctx = franchiseeCtx(tenant.id, location.id);
    const products = await getCatalogForLocation(ctx, tenant.id);

    expect(products.map((p) => p.name)).toEqual(["Orderable"]);
    // Admin-only fields never leak into the store-facing payload.
    expect(products[0]).not.toHaveProperty("shopifyId");
  });

  it("filters by search term (name, SKU, category) and by category", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    await seedProduct(tenant.id, { name: "Volt Hoodie", sku: "HOOD-1", category: "Apparel", variants: [{ priceCents: 4500 }] });
    await seedProduct(tenant.id, { name: "Tumbler", sku: "TUM-9", category: "Kitchenware", variants: [{ priceCents: 2200 }] });

    const ctx = franchiseeCtx(tenant.id, location.id);

    expect((await getCatalogForLocation(ctx, tenant.id, { q: "hoodie" })).map((p) => p.sku)).toEqual(["HOOD-1"]);
    expect((await getCatalogForLocation(ctx, tenant.id, { q: "TUM-9" })).map((p) => p.sku)).toEqual(["TUM-9"]);
    expect((await getCatalogForLocation(ctx, tenant.id, { q: "kitchen" })).map((p) => p.sku)).toEqual(["TUM-9"]);
    expect((await getCatalogForLocation(ctx, tenant.id, { category: "Apparel" })).map((p) => p.sku)).toEqual(["HOOD-1"]);
    expect(await getCatalogForLocation(ctx, tenant.id, { q: "does-not-exist" })).toEqual([]);
  });

  it("never returns another tenant's products, even when requested explicitly", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const other = await seedTenantWithLocation();
    await seedProduct(other.tenant.id, { name: "Other brand product", sku: "OTHER-1", variants: [{ priceCents: 1000 }] });

    const ctx = franchiseeCtx(tenant.id, location.id);
    // Own-tenant query: other tenant's catalog is invisible.
    expect(await getCatalogForLocation(ctx, tenant.id)).toEqual([]);
    // Forged tenantId: RLS still pins results to the caller's own tenant.
    expect(await getCatalogForLocation(ctx, other.tenant.id)).toEqual([]);
  });
});
