import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrdersPanel } from "@/components/admin/OrdersPanel";

export default async function OrdersPage() {
  const ctx = await requireRole("KICK_ADMIN")();

  const orders = await withTenant(ctx, (tx) =>
    tx.order.findMany({
      include: { lines: { include: { variant: true } }, location: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">Cross-tenant order activity.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All orders</CardTitle>
        </CardHeader>
        <CardContent>
          <OrdersPanel
            orders={orders.map((o) => ({
              id: o.id,
              locationName: o.location.name,
              status: o.status,
              subtotalCents: o.subtotalCents,
              allowanceAppliedCents: o.allowanceAppliedCents,
              cardChargedCents: o.cardChargedCents,
              refundedCents: o.refundedCents,
              currency: o.currency,
              createdAt: o.createdAt.toISOString(),
              lines: o.lines.map((l) => ({
                id: l.id,
                variantName: l.variant.name,
                qty: l.qty,
                unitPriceCents: l.unitPriceCents,
              })),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
