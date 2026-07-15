import { getRequestContext } from "@/server/modules/identity/requestContext";
import { getCatalogForLocation } from "@/server/modules/commerce/products";
import { ShopGrid } from "@/components/franchisee/ShopGrid";

export default async function ShopPage() {
  const ctx = await getRequestContext();
  const products = await getCatalogForLocation(ctx, ctx.tenantId!);

  const items = products.map((p) => ({
    productId: p.id,
    productName: p.name,
    variants: p.variants.map((v) => ({
      variantId: v.id,
      name: v.name,
      priceCents: v.priceCents,
      currency: v.currency,
      inStock: v.stock === null || v.stock > 0,
    })),
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Shop</h1>
      <ShopGrid products={items} />
    </div>
  );
}
