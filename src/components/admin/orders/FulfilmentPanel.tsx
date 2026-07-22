"use client";

import { useState, useTransition } from "react";
import { PackageOpen, Truck, CircleCheckBig, XCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InlineLoader } from "@/components/ui/InlineLoader";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { CARRIERS } from "@/lib/orderStatus";
import { formatCents } from "@/lib/utils";
import {
  markProcessingAction,
  markShippedAction,
  markDeliveredAction,
  cancelOrderAction,
  refundOrderAction,
} from "@/app/admin/orders/fulfilmentActions";

type ActionResult = { ok: boolean; message?: string };

/**
 * KICK_ADMIN fulfilment controls for one order. Which buttons render is
 * decided from the order's current status, but the server re-validates every
 * transition — these are conveniences, not the guard.
 */
export function FulfilmentPanel({
  orderId,
  status,
  cardChargedCents,
  refundableCents,
}: {
  orderId: string;
  status: string;
  cardChargedCents: number;
  refundableCents: number;
}) {
  const [pending, start] = useTransition();
  const [shipOpen, setShipOpen] = useState(false);
  const [carrier, setCarrier] = useState("canada-post");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [eta, setEta] = useState("");

  function runAction(label: string, fn: () => Promise<ActionResult>) {
    start(async () => {
      const result = await fn();
      if (result.ok) toast.success(`${label} — done`);
      else toast.error(result.message ?? `${label} failed`);
    });
  }

  const canProcess = status === "PAID";
  const canShip = status === "PAID" || status === "PROCESSING";
  const canDeliver = status === "SHIPPED";
  const canCancel = status === "PENDING" || ((status === "PAID" || status === "PROCESSING") && cardChargedCents === 0);
  const canRefund = refundableCents > 0 && ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "FULFILLED", "PARTIALLY_REFUNDED"].includes(status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canProcess && (
        <ActionButton
          icon={<PackageOpen className="h-4 w-4" aria-hidden="true" />}
          label="Mark Processing"
          disabled={pending}
          onClick={() => runAction("Mark processing", () => markProcessingAction(orderId))}
        />
      )}

      {canShip && (
        <ActionButton
          icon={<Truck className="h-4 w-4" aria-hidden="true" />}
          label="Mark Shipped"
          disabled={pending}
          onClick={() => setShipOpen(true)}
        />
      )}

      {canDeliver && (
        <ActionButton
          icon={<CircleCheckBig className="h-4 w-4" aria-hidden="true" />}
          label="Mark Delivered"
          disabled={pending}
          onClick={() => runAction("Mark delivered", () => markDeliveredAction(orderId))}
        />
      )}

      {canCancel && (
        <ConfirmDialog
          trigger={
            <button className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-status-error/40 px-3 text-sm font-medium text-status-error hover:bg-status-error/5">
              <XCircle className="h-4 w-4" aria-hidden="true" /> Cancel Order
            </button>
          }
          title="Cancel order"
          description="Cancel this order? Any allowance used is credited back to the store's ledger, and an uncaptured card authorisation is voided in Stripe. The store will be notified."
          confirmLabel="Cancel order"
          destructive
          action={async () => {
            const result = await cancelOrderAction(orderId);
            if (!result.ok) throw new Error(result.message ?? "Could not cancel this order");
          }}
        />
      )}

      {canRefund && (
        <ConfirmDialog
          trigger={
            <button className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-status-error/40 px-3 text-sm font-medium text-status-error hover:bg-status-error/5">
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Refund {formatCents(refundableCents)}
            </button>
          }
          title="Refund order"
          description={`Refund the remaining ${formatCents(refundableCents)}? The card portion is refunded through Stripe and allowance-funded amounts are credited back to the store's ledger. This cannot be undone.`}
          confirmLabel="Issue refund"
          destructive
          action={async () => {
            const result = await refundOrderAction(orderId);
            if (!result.ok) throw new Error(result.message ?? "Refund failed");
          }}
        />
      )}

      <Dialog open={shipOpen} onOpenChange={(v) => !pending && setShipOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as shipped</DialogTitle>
            <DialogClose onClick={() => setShipOpen(false)} />
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Carrier
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="min-h-10 rounded-md border border-border bg-card px-2 text-sm font-normal"
              >
                {Object.entries(CARRIERS).map(([key, c]) => (
                  <option key={key} value={key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Tracking number
              <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="e.g. 1Z999AA10123456784" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Estimated delivery (optional)
              <Input type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShipOpen(false)}
                disabled={pending}
                className="min-h-10 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
              >
                Back
              </button>
              <button
                type="button"
                disabled={pending || trackingNumber.trim().length < 4}
                onClick={() =>
                  start(async () => {
                    const result = await markShippedAction(orderId, {
                      carrier,
                      trackingNumber: trackingNumber.trim(),
                      estimatedDeliveryAt: eta || undefined,
                    });
                    if (result.ok) {
                      toast.success("Order marked shipped — the store has been notified.");
                      setShipOpen(false);
                    } else {
                      toast.error(result.message ?? "Could not mark shipped");
                    }
                  })
                }
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {pending ? <InlineLoader label="Saving…" /> : "Mark shipped"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
    >
      {icon} {label}
    </button>
  );
}
