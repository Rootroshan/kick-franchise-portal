import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { ProductDetailAddToCart } from "@/components/franchisee/ProductDetailAddToCart";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: { productId: string } }) {
  const ctx = await requireRole("FRANCHISEE_USER")();

  // Tenant-scoped + active-only. RLS also restricts to the caller's tenant and
  // active products, so another tenant's or an inactive product can't be viewed.
  const product = await withTenant(ctx, (tx) =>
    tx.product.findFirst({
      where: { id: params.productId, tenantId: ctx.tenantId ?? undefined, active: true },
      include: { variants: { where: { active: true }, orderBy: { priceCents: "asc" } } },
    })
  );
  if (!product) notFound();

  const variants = product.variants.map((v) => ({
    variantId: v.id,
    name: v.name,
    priceCents: v.priceCents,
    currency: v.currency,
    inStock: v.stock === null || v.stock > 0,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Shop
      </Link>

      <div className="flex aspect-video items-center justify-center rounded-xl border border-border bg-muted">
        <Package className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
      </div>

      <div>
        <h1 className="text-lg font-semibold">{product.name}</h1>
        <p className="text-xs text-muted-foreground">SKU {product.sku}</p>
      </div>

      {variants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No variants available for your store.</p>
      ) : (
        <ProductDetailAddToCart productName={product.name} variants={variants} />
      )}
    </div>
  );
}
