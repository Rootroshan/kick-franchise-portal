"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCents, formatDateTime } from "@/lib/utils";

type OrderLine = { id: string; variantName: string; qty: number; unitPriceCents: number };
type Order = {
  id: string;
  locationName: string;
  status: string;
  subtotalCents: number;
  allowanceAppliedCents: number;
  cardChargedCents: number;
  refundedCents: number;
  currency: string;
  createdAt: string;
  lines: OrderLine[];
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  COMPLETED: "success",
  PENDING: "warning",
  CANCELLED: "destructive",
  REFUNDED: "muted",
};

export function OrdersPanel({ orders }: { orders: Order[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {orders.map((order) => {
        const isOpen = expanded.has(order.id);
        return (
          <div key={order.id} className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => toggle(order.id)}
              className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm"
            >
              <span className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium">{order.locationName}</span>
                <span className="text-muted-foreground">{formatDateTime(order.createdAt)}</span>
              </span>
              <span className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[order.status] ?? "outline"}>{order.status}</Badge>
                <span className="font-semibold">{formatCents(order.subtotalCents, order.currency)}</span>
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-border p-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 pr-4">Variant</th>
                      <th className="py-1 pr-4">Qty</th>
                      <th className="py-1 pr-4">Unit price</th>
                      <th className="py-1 pr-4">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="py-1 pr-4">{l.variantName}</td>
                        <td className="py-1 pr-4">{l.qty}</td>
                        <td className="py-1 pr-4">{formatCents(l.unitPriceCents, order.currency)}</td>
                        <td className="py-1 pr-4">{formatCents(l.unitPriceCents * l.qty, order.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground sm:grid-cols-4">
                  <span>Allowance applied: {formatCents(order.allowanceAppliedCents, order.currency)}</span>
                  <span>Card charged: {formatCents(order.cardChargedCents, order.currency)}</span>
                  <span>Refunded: {formatCents(order.refundedCents, order.currency)}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
    </div>
  );
}
