import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { formatCents } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  PAID: "success",
  FULFILLED: "success",
  PENDING: "warning",
  PARTIALLY_REFUNDED: "warning",
  REFUNDED: "muted",
  CANCELLED: "muted",
  FAILED: "destructive",
};

export default async function OrderDetailPage({ params }: { params: { orderId: string } }) {
  const ctx = await requireRole("FRANCHISEE_USER")();

  // Store isolation: scope by id AND the caller's own location. Changing the
  // URL id to another store's order returns null → notFound (never leaks).
  const order = await withTenant(ctx, (tx) =>
    tx.order.findFirst({
      where: { id: params.orderId, locationId: ctx.locationId ?? undefined, tenantId: ctx.tenantId ?? undefined },
      include: { lines: { include: { variant: { include: { product: { select: { name: true } } } } } } },
    })
  );
  if (!order) notFound();

  const refundedCents = order.refundedCents;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Order history
      </Link>

      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-mono text-lg font-semibold">#{order.id.slice(0, 8)}</h1>
          <p className="text-xs text-muted-foreground">{order.createdAt.toLocaleString()}</p>
        </div>
        <Badge variant={STATUS_TONE[order.status] ?? "secondary"}>{order.status}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Items</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-0">
          {order.lines.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{l.variant.product.name}</div>
                <div className="text-xs text-muted-foreground">{l.variant.name} · {formatCents(l.unitPriceCents, order.currency)} × {l.qty}</div>
              </div>
              <div className="shrink-0 text-sm font-medium tabular-nums">{formatCents(l.unitPriceCents * l.qty, order.currency)}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Payment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 pt-0 text-sm">
          <Row label="Subtotal" value={formatCents(order.subtotalCents, order.currency)} />
          <Row label="Allowance applied" value={`− ${formatCents(order.allowanceAppliedCents, order.currency)}`} />
          <Row label="Card charged" value={formatCents(order.cardChargedCents, order.currency)} strong />
          {refundedCents > 0 && <Row label="Refunded" value={formatCents(refundedCents, order.currency)} />}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</span>
    </div>
  );
}
