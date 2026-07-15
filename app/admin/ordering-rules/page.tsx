import { requireRole } from "@/server/modules/identity/guard";
import { listLocations } from "@/server/modules/tenants/service";
import { listProducts } from "@/server/modules/commerce/products";
import { withTenant } from "@/server/db/withTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderingRulesPanel } from "@/components/admin/OrderingRulesPanel";

export default async function OrderingRulesPage() {
  const ctx = await requireRole("KICK_ADMIN")();
  const tenantId = ctx.tenantId!;

  const [locations, products, rules] = await Promise.all([
    listLocations(ctx, tenantId),
    listProducts(ctx, tenantId),
    withTenant(ctx, (tx) =>
      tx.locationOrderingRule.findMany({
        where: { location: { tenantId } },
        include: { location: true, product: true },
        orderBy: { createdAt: "desc" },
      })
    ),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Ordering Rules</h1>
        <p className="text-sm text-muted-foreground">Min/max quantity and cadence constraints per location.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderingRulesPanel
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
            products={products.map((p) => ({ id: p.id, name: p.name }))}
            initialRules={rules.map((r) => ({
              id: r.id,
              locationName: r.location.name,
              productName: r.product?.name ?? null,
              minQty: r.minQty,
              maxQty: r.maxQty,
              cadenceDays: r.cadenceDays,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
