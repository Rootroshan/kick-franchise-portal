import Link from "next/link";
import { CircleCheckBig, Package, Wallet } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { formatCents } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/** Post-checkout confirmation. Shows the caller's most recent order (or an
 *  order by ?order= id, scoped to their own location so it can't leak). */
export default async function CheckoutSuccessPage({ searchParams }: { searchParams: { order?: string } }) {
  const ctx = await requireRole("FRANCHISEE_USER")();

  const order = await withTenant(ctx, (tx) =>
    tx.order.findFirst({
      where: { locationId: ctx.locationId ?? undefined, ...(searchParams.order ? { id: searchParams.order } : {}) },
      orderBy: { createdAt: "desc" },
      select: { id: true, subtotalCents: true, allowanceAppliedCents: true, cardChargedCents: true, currency: true, status: true },
    })
  );

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-success/10">
        <CircleCheckBig className="h-8 w-8 text-status-success" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Order placed</h1>
        <p className="text-sm text-muted-foreground">Your order has been submitted{order ? ` (#${order.id.slice(0, 8)})` : ""}.</p>
      </div>

      {order && (
        <Card className="w-full">
          <CardContent className="flex flex-col gap-2 p-4 text-left text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatCents(order.subtotalCents, order.currency)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span className="flex items-center gap-1"><Wallet className="h-4 w-4" /> Allowance applied</span><span className="tabular-nums">− {formatCents(order.allowanceAppliedCents, order.currency)}</span></div>
            <div className="flex justify-between font-semibold"><span>Card charged</span><span className="tabular-nums">{formatCents(order.cardChargedCents, order.currency)}</span></div>
          </CardContent>
        </Card>
      )}

      <div className="flex w-full flex-col gap-2">
        {order && (
          <Link href={`/orders/${order.id}`} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground">
            <Package className="h-4 w-4" /> View order
          </Link>
        )}
        <Link href="/shop" className="flex min-h-11 items-center justify-center rounded-lg border border-border text-sm font-medium hover:bg-muted">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
