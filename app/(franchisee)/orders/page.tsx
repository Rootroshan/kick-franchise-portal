import { getRequestContext } from "@/server/modules/identity/requestContext";
import { withTenant } from "@/server/db/withTenant";
import { OrderList } from "@/components/franchisee/OrderList";

export default async function OrdersPage() {
  const ctx = await getRequestContext();
  // Mirrors app/api/orders/route.ts: franchisee sees only their own location's orders.
  const orders = await withTenant(ctx, (tx) =>
    tx.order.findMany({
      where: { locationId: ctx.locationId! },
      include: { lines: { include: { variant: true } } },
      orderBy: { createdAt: "desc" },
    })
  );

  const items = orders.map((o) => ({
    id: o.id,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    subtotalCents: o.subtotalCents,
    allowanceAppliedCents: o.allowanceAppliedCents,
    cardChargedCents: o.cardChargedCents,
    currency: o.currency,
    lines: o.lines.map((l) => ({
      id: l.id,
      variantName: l.variant.name,
      qty: l.qty,
      unitPriceCents: l.unitPriceCents,
    })),
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Order History</h1>
      <OrderList orders={items} />
    </div>
  );
}
