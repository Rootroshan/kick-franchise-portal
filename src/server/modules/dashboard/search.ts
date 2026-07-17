import { withTenant, type RequestContext } from "@/server/db/withTenant";

export type SearchResults = {
  brands: Array<{ id: string; name: string; slug: string }>;
  stores: Array<{ id: string; name: string; tenantName: string }>;
  users: Array<{ id: string; name: string; email: string | null; role: string }>;
  orders: Array<{ id: string; tenantName: string; storeName: string; status: string }>;
  products: Array<{ id: string; name: string; sku: string; tenantName: string }>;
};

/** Global admin search across brands, stores, users, orders, products.
 *  KICK_ADMIN only (cross-tenant via RLS). Case-insensitive contains. */
export async function adminSearch(ctx: RequestContext, q: string): Promise<SearchResults> {
  const term = q.trim();
  if (term.length < 2) return { brands: [], stores: [], users: [], orders: [], products: [] };
  const ci = { contains: term, mode: "insensitive" as const };

  return withTenant(ctx, async (tx) => {
    const [brands, stores, users, orders, products] = await Promise.all([
      tx.tenant.findMany({ where: { OR: [{ name: ci }, { slug: ci }] }, take: 8 }),
      tx.location.findMany({ where: { name: ci }, take: 8, include: { tenant: true } }),
      tx.membership.findMany({ where: { OR: [{ email: ci }, { displayName: ci }] }, take: 8 }),
      // Order id is a uuid — match on prefix; also match by store name.
      tx.order.findMany({ where: { OR: [{ id: { startsWith: term } }, { location: { name: ci } }] }, take: 8, include: { tenant: true, location: true } }),
      tx.product.findMany({ where: { OR: [{ name: ci }, { sku: ci }] }, take: 8, include: { tenant: true } }),
    ]);

    return {
      brands: brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug })),
      stores: stores.map((s) => ({ id: s.id, name: s.name, tenantName: s.tenant.name })),
      users: users.map((u) => ({ id: u.id, name: u.displayName ?? "(no name)", email: u.email, role: u.role })),
      orders: orders.map((o) => ({ id: o.id, tenantName: o.tenant.name, storeName: o.location.name, status: o.status })),
      products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, tenantName: p.tenant.name })),
    };
  });
}
