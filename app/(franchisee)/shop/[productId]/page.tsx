import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Info } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { ProductDetailAddToCart } from "@/components/franchisee/ProductDetailAddToCart";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: { productId: string } }) {
  const ctx = await requireRole("FRANCHISEE_USER")();

  // Tenant-scoped + active-only, and ordering rules for this store in the same
  // round trip. RLS also restricts to the caller's tenant, so another tenant's
  // or an inactive product can't be viewed by editing the URL.
  const [product, rules] = await Promise.all([
    withTenant(ctx, (tx) =>
      tx.product.findFirst({
        where: { id: params.productId, tenantId: ctx.tenantId ?? undefined, active: true },
        include: { variants: { where: { active: true }, orderBy: { priceCents: "asc" } } },
      })
    ),
    ctx.locationId
      ? withTenant(ctx, (tx) =>
          tx.locationOrderingRule.findMany({
            where: { locationId: ctx.locationId!, OR: [{ productId: params.productId }, { productId: null }] },
          })
        )
      : Promise.resolve([]),
  ]);
  if (!product) notFound();

  // Effective bounds across global + product rules: the tightest wins — the
  // server enforces the same set at checkout (assertOrderingRulesSatisfied).
  const minQty = Math.max(1, ...rules.map((r) => r.minQty ?? 1));
  const maxQtyValues = rules.map((r) => r.maxQty).filter((v): v is number => v !== null);
  const maxQty = maxQtyValues.length ? Math.min(...maxQtyValues) : null;
  const cadenceDays = rules.map((r) => r.cadenceDays).filter((v): v is number => v !== null)[0] ?? null;

  const ruleNotes: string[] = [];
  if (minQty > 1) ruleNotes.push(`Minimum order quantity is ${minQty}`);
  if (maxQty !== null) ruleNotes.push(`Maximum allowed quantity is ${maxQty}`);
  if (cadenceDays !== null) ruleNotes.push(`This product can be ordered once every ${cadenceDays} days for your store`);

  const variants = product.variants.map((v) => ({
    variantId: v.id,
    name: v.name,
    priceCents: v.priceCents,
    currency: v.currency,
    stock: v.stock,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Shop
      </Link>

      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- tenant-supplied remote hosts aren't in next/image allowlist
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-4" />
        ) : (
          <Package className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      <div>
        <h1 className="text-xl font-bold">{product.name}</h1>
        <p className="text-xs text-muted-foreground">
          SKU {product.sku}
          {product.category ? ` · ${product.category}` : ""}
        </p>
        {product.description && <p className="mt-2 text-sm text-muted-foreground">{product.description}</p>}
      </div>

      {ruleNotes.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-sm">
          {ruleNotes.map((note) => (
            <p key={note} className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-status-info" aria-hidden="true" />
              {note}
            </p>
          ))}
        </div>
      )}

      {variants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No variants available for your store.</p>
      ) : (
        <ProductDetailAddToCart productName={product.name} variants={variants} minQty={minQty} maxQty={maxQty} />
      )}
    </div>
  );
}
