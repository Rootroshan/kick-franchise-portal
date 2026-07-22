import { requireRole } from "@/server/modules/identity/guard";
import { getCatalogForLocation } from "@/server/modules/commerce/products";
import { getStoreAllowances } from "@/server/modules/allowances/store";
import { ShopBrowser, type CatalogProduct, type ShopAllowance } from "@/components/franchisee/ShopBrowser";

export const dynamic = "force-dynamic";

function currentPeriodLabel(date = new Date()): string {
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export default async function ShopPage() {
  const ctx = await requireRole("FRANCHISEE_USER")();

  // Catalog and allowance are independent — fetch in parallel.
  const [products, allowances] = await Promise.all([
    getCatalogForLocation(ctx, ctx.tenantId!),
    getStoreAllowances(ctx).catch(() => []),
  ]);

  // Only the CURRENT period is spendable at checkout, so that's the one the
  // shop banner shows. Older periods remain visible on /allowances.
  const active = allowances.find((a) => a.periodLabel === currentPeriodLabel());
  const allowance: ShopAllowance | null = active
    ? {
        periodLabel: active.periodLabel,
        currency: active.currency,
        grantedCents: active.grantedCents,
        usedCents: active.usedCents,
        balanceCents: active.balanceCents,
      }
    : null;

  const items: CatalogProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    description: p.description,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt.toISOString(),
    variants: p.variants,
  }));

  return <ShopBrowser initialProducts={items} allowance={allowance} />;
}
