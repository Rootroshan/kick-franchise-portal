import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getOrderById } from "@/server/modules/commerce/admin";
import { HttpError } from "@/server/modules/identity/errors";
import { formatCents, formatDate, formatDateTime } from "@/lib/utils";
import { carrierLabel, trackingUrl, orderRef } from "@/lib/orderStatus";
import { PageHeader, StatusBadge, EmptyState } from "@/components/admin/kit";
import { FulfilmentPanel } from "@/components/admin/orders/FulfilmentPanel";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireRole("KICK_ADMIN")();

  let order;
  try {
    order = await getOrderById(ctx, params.id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  const tracking = trackingUrl(order.carrier, order.trackingNumber);
  const remainingRefundable = order.subtotalCents - order.refundedCents;
  const showCancellationRequest = order.cancellationRequestedAt && !["CANCELLED", "REFUNDED"].includes(order.status);

  return (
    <div>
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </Link>

      <PageHeader
        title={`Order ${orderRef(order.brandName, order.orderNumber)}`}
        description={`${order.brandName} · ${order.storeName} · ${order.createdAt.toLocaleString()}`}
        secondaryAction={<StatusBadge status={order.status} />}
      />

      {showCancellationRequest && (
        <div className="mb-4 rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-sm">
          <p className="font-medium">Cancellation requested by the store</p>
          <p className="text-muted-foreground">
            {formatDateTime(order.cancellationRequestedAt!)}
            {order.cancellationReason ? ` — “${order.cancellationReason}”` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Approve by cancelling (allowance-only orders) or refunding (card-charged orders) below.
          </p>
        </div>
      )}

      <div className="mb-4">
        <FulfilmentPanel
          orderId={order.id}
          status={order.status}
          cardChargedCents={order.cardChargedCents}
          refundableCents={remainingRefundable}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Money label="Subtotal" cents={order.subtotalCents} />
        <Money label="Allowance Applied" cents={order.allowanceAppliedCents} />
        <Money label="Card Charged" cents={order.cardChargedCents} />
        <Money label="Refunded" cents={order.refundedCents} tone={order.refundedCents > 0 ? "error" : undefined} />
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Truck className="h-4 w-4 text-muted-foreground" /> Fulfilment
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
          <Fact label="Paid" value={order.paidAt ? formatDateTime(order.paidAt) : "—"} />
          <Fact label="Processing" value={order.processingAt ? formatDateTime(order.processingAt) : "—"} />
          <Fact label="Shipped" value={order.shippedAt ? formatDateTime(order.shippedAt) : "—"} />
          <Fact label="Delivered" value={order.deliveredAt ? formatDateTime(order.deliveredAt) : "—"} />
          <Fact label="Carrier" value={carrierLabel(order.carrier) ?? "—"} />
          <Fact
            label="Tracking"
            value={
              order.trackingNumber ? (
                tracking ? (
                  <a href={tracking} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-primary hover:underline">
                    {order.trackingNumber}
                  </a>
                ) : (
                  order.trackingNumber
                )
              ) : (
                "—"
              )
            }
          />
          {order.estimatedDeliveryAt && <Fact label="Est. delivery" value={formatDate(order.estimatedDeliveryAt)} />}
          {order.cancelledAt && <Fact label="Cancelled" value={formatDateTime(order.cancelledAt)} />}
          {order.refundedAt && <Fact label="Refunded" value={formatDateTime(order.refundedAt)} />}
        </dl>
      </div>

      <h2 className="mb-2 text-sm font-semibold">Line Items</h2>
      {order.lines.length === 0 ? (
        <EmptyState title="No line items" />
      ) : (
        <div className="scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Product</th>
                <th className="px-3 py-2.5 font-medium">Variant</th>
                <th className="px-3 py-2.5 font-medium">Qty</th>
                <th className="px-3 py-2.5 font-medium">Unit</th>
                <th className="px-3 py-2.5 font-medium">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 font-medium">{l.productName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{l.variantName}</td>
                  <td className="px-3 py-2.5 tabular-nums">{l.qty}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatCents(l.unitPriceCents)}</td>
                  <td className="px-3 py-2.5 font-medium tabular-nums">{formatCents(l.unitPriceCents * l.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Placed by {order.placedBy}</p>
    </div>
  );
}

function Money({ label, cents, tone }: { label: string; cents: number; tone?: "error" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${tone === "error" ? "text-status-error" : ""}`}>{formatCents(cents)}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
