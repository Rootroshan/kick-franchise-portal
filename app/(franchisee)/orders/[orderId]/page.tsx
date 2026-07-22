/* eslint-disable @next/next/no-img-element -- product images are remote/unoptimized tenant uploads */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Store, Truck, Wallet } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getStoreOrderDetail, canRequestCancellation } from "@/server/modules/commerce/storeOrders";
import { DISPLAY_LABEL, DISPLAY_STATUS, DISPLAY_TONE, orderRef, trackingUrl, carrierLabel } from "@/lib/orderStatus";
import { formatCents, formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderTimeline } from "@/components/franchisee/orders/OrderTimeline";
import { TrackOrderLink } from "@/components/franchisee/orders/TrackOrderLink";
import { ReorderButton } from "@/components/franchisee/orders/ReorderButton";
import { RequestCancelButton } from "@/components/franchisee/orders/RequestCancelButton";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { orderId: string } }) {
  const ctx = await requireRole("FRANCHISEE_USER")();

  // Scoped to the caller's own (tenant, location) inside getStoreOrderDetail —
  // a forged id from another store resolves to null → 404, never a leak.
  const order = await getStoreOrderDetail(ctx, params.orderId);
  if (!order) notFound();

  const display = DISPLAY_STATUS[order.status];
  const ref = orderRef(order.brandName, order.orderNumber);
  const tracking = trackingUrl(order.carrier, order.trackingNumber);
  const totalPaidCents = order.allowanceAppliedCents + order.cardChargedCents;
  const canReorder = ["delivered", "cancelled", "refunded"].includes(display);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Orders
      </Link>

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{ref}</h1>
          <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Store className="h-3.5 w-3.5" aria-hidden="true" /> {order.storeName}
          </p>
        </div>
        <Badge variant={DISPLAY_TONE[display]}>{DISPLAY_LABEL[display]}</Badge>
      </div>

      {order.cancellationRequestedAt && !["cancelled", "refunded"].includes(display) && (
        <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-sm">
          Cancellation requested {formatDateTime(order.cancellationRequestedAt)} — waiting for your brand team to review.
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Status</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <OrderTimeline order={order} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Truck className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 pt-0 text-sm">
          {order.trackingNumber ? (
            <>
              <Row label="Carrier" value={carrierLabel(order.carrier) ?? "—"} />
              <Row label="Tracking number" value={order.trackingNumber} mono />
              {order.shippedAt && <Row label="Shipped" value={formatDateTime(order.shippedAt)} />}
              {order.estimatedDeliveryAt && !order.deliveredAt && <Row label="Estimated delivery" value={formatDate(order.estimatedDeliveryAt)} />}
              {order.deliveredAt && <Row label="Delivered" value={formatDateTime(order.deliveredAt)} />}
              {tracking && <TrackOrderLink href={tracking} className="mt-1" />}
            </>
          ) : (
            <p className="text-muted-foreground">Tracking will appear after your order has shipped.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Items ({order.lines.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          {order.lines.map((line) => (
            <div key={line.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                {line.imageUrl ? (
                  <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{line.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {line.variantName} · SKU {line.sku}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCents(line.unitPriceCents, order.currency)} × {line.qty}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums">{formatCents(line.unitPriceCents * line.qty, order.currency)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 pt-0 text-sm">
          <Row label="Subtotal" value={formatCents(order.subtotalCents, order.currency)} />
          <Row label="Allowance applied" value={`− ${formatCents(order.allowanceAppliedCents, order.currency)}`} />
          <Row label="Card charged" value={formatCents(order.cardChargedCents, order.currency)} />
          <div className="my-1 border-t border-border" />
          <Row label="Order total" value={formatCents(order.subtotalCents, order.currency)} strong />
          <Row
            label="Payment status"
            value={order.paidAt ? `Paid ${formatDateTime(order.paidAt)}` : order.status === "FAILED" ? "Payment failed" : "Awaiting payment"}
          />
          {order.refundedCents > 0 && (
            <Row label={order.status === "REFUNDED" ? "Refunded" : "Partially refunded"} value={formatCents(order.refundedCents, order.currency)} />
          )}
          {totalPaidCents !== order.subtotalCents && order.paidAt && (
            <Row label="Total paid" value={formatCents(totalPaidCents, order.currency)} />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {canReorder && <ReorderButton orderId={order.id} />}
        {canRequestCancellation(order) && <RequestCancelButton orderId={order.id} />}
      </div>
    </div>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${strong ? "font-semibold" : ""} ${mono ? "font-mono text-xs" : ""} tabular-nums`}>{value}</span>
    </div>
  );
}
