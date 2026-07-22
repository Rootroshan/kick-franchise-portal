import Link from "next/link";
import { ChevronRight, Package, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCents, formatDate, formatDateTime } from "@/lib/utils";
import { DISPLAY_LABEL, DISPLAY_STATUS, DISPLAY_TONE, orderRef, trackingUrl, carrierLabel } from "@/lib/orderStatus";
import type { StoreOrderRow } from "@/server/modules/commerce/storeOrders";
import { TrackOrderLink } from "./TrackOrderLink";

/**
 * One order in the history list. The whole card is one Link (keyboard
 * accessible for free); the Track Order action sits outside the link so the
 * two targets don't nest interactive elements.
 */
export function OrderCard({ order, brandName }: { order: StoreOrderRow; brandName: string }) {
  const display = DISPLAY_STATUS[order.status];
  const tracking = trackingUrl(order.carrier, order.trackingNumber);

  return (
    <div className="rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
      <Link
        href={`/orders/${order.id}`}
        className="flex flex-col gap-2 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`Order ${orderRef(brandName, order.orderNumber)}, ${DISPLAY_LABEL[display]}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{orderRef(brandName, order.orderNumber)}</span>
          <Badge variant={DISPLAY_TONE[display]}>{DISPLAY_LABEL[display]}</Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          {formatDateTime(order.createdAt)} · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
        </p>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums">{formatCents(order.subtotalCents, order.currency)}</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            View details <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>

        {display === "shipped" && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Truck className="h-3.5 w-3.5" aria-hidden="true" />
            {carrierLabel(order.carrier)} {order.trackingNumber}
            {order.estimatedDeliveryAt && <> · est. delivery {formatDate(order.estimatedDeliveryAt)}</>}
          </p>
        )}
        {display === "delivered" && order.deliveredAt && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Package className="h-3.5 w-3.5" aria-hidden="true" /> Delivered {formatDate(order.deliveredAt)}
          </p>
        )}
        {display === "cancelled" && order.cancelledAt && (
          <p className="text-xs text-muted-foreground">Cancelled {formatDate(order.cancelledAt)}</p>
        )}
        {display === "refunded" && order.refundedAt && (
          <p className="text-xs text-muted-foreground">Refunded {formatDate(order.refundedAt)}</p>
        )}
      </Link>

      {tracking && (
        <div className="border-t border-border px-4 py-2">
          <TrackOrderLink href={tracking} />
        </div>
      )}
    </div>
  );
}
