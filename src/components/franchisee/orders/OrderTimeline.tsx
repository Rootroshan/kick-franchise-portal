import { Check, X } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import type { StoreOrderDetail } from "@/server/modules/commerce/storeOrders";

type Step = { label: string; at: Date | null; done: boolean };

/**
 * Order status timeline. A step only renders as completed when its backing
 * timestamp (or, for legacy rows, the status itself) proves the event
 * happened — no invented progress. Cancelled/refunded/failed orders show the
 * normal flow up to where it stopped, then the terminal event.
 */
export function OrderTimeline({ order }: { order: Pick<StoreOrderDetail, "status" | "createdAt" | "paidAt" | "processingAt" | "shippedAt" | "deliveredAt" | "cancelledAt" | "refundedAt"> }) {
  const terminal =
    order.status === "CANCELLED"
      ? { label: "Order cancelled", at: order.cancelledAt }
      : order.status === "REFUNDED" || order.status === "PARTIALLY_REFUNDED"
        ? { label: order.status === "REFUNDED" ? "Order refunded" : "Partially refunded", at: order.refundedAt }
        : order.status === "FAILED"
          ? { label: "Payment failed", at: null }
          : null;

  // Legacy FULFILLED rows predate processing/shipping timestamps: they're
  // delivered without intermediate events, so intermediate steps stay honest
  // (not done, no timestamp) and only "Delivered" completes.
  const steps: Step[] = [
    { label: "Order placed", at: order.createdAt, done: true },
    { label: "Payment confirmed", at: order.paidAt, done: Boolean(order.paidAt) },
    { label: "Processing", at: order.processingAt, done: Boolean(order.processingAt) },
    { label: "Shipped", at: order.shippedAt, done: Boolean(order.shippedAt) },
    { label: "Delivered", at: order.deliveredAt, done: Boolean(order.deliveredAt) || order.status === "FULFILLED" },
  ];

  // After a terminal event, pending future steps are irrelevant — cut the
  // flow after the last completed step so it reads "stopped here".
  const visible = terminal ? steps.filter((s) => s.done) : steps;

  return (
    <ol className="flex flex-col">
      {visible.map((step, i) => (
        <TimelineRow
          key={step.label}
          label={step.label}
          at={step.at}
          done={step.done}
          isLast={i === visible.length - 1 && !terminal}
        />
      ))}
      {terminal && <TimelineRow label={terminal.label} at={terminal.at} done terminal isLast />}
    </ol>
  );
}

function TimelineRow({ label, at, done, terminal, isLast }: { label: string; at: Date | null; done: boolean; terminal?: boolean; isLast: boolean }) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
            terminal
              ? "border-status-error/40 bg-status-error/10 text-status-error"
              : done
                ? "border-status-success/40 bg-status-success/10 text-status-success"
                : "border-border bg-muted text-muted-foreground"
          )}
        >
          {terminal ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        </span>
        {!isLast && <span className={cn("w-px flex-1", done ? "bg-status-success/40" : "bg-border")} aria-hidden="true" />}
      </div>
      <div className={cn("pb-4", isLast && "pb-0")}>
        <p className={cn("text-sm font-medium", !done && "text-muted-foreground")}>{label}</p>
        {at ? (
          <p className="text-xs text-muted-foreground">{formatDateTime(at)}</p>
        ) : done ? null : (
          <p className="text-xs text-muted-foreground">Pending</p>
        )}
      </div>
    </li>
  );
}
