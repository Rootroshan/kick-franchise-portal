"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import { cn, formatCents, formatDateTime } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

type OrderLineItem = {
  id: string;
  variantName: string;
  qty: number;
  unitPriceCents: number;
};

type OrderItem = {
  id: string;
  status: OrderStatus;
  createdAt: string;
  subtotalCents: number;
  allowanceAppliedCents: number;
  cardChargedCents: number;
  currency: string;
  lines: OrderLineItem[];
};

const STATUS_VARIANT: Record<OrderStatus, "success" | "warning" | "destructive" | "muted"> = {
  PAID: "success",
  FULFILLED: "success",
  PENDING: "warning",
  CANCELLED: "muted",
  FAILED: "destructive",
  REFUNDED: "muted",
  PARTIALLY_REFUNDED: "muted",
};

export function OrderList({ orders }: { orders: OrderItem[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (orders.length === 0) return <p className="text-sm text-muted-foreground">No orders yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => {
        const isOpen = expanded.has(order.id);
        return (
          <Card key={order.id}>
            <CardHeader className="cursor-pointer pb-2" onClick={() => toggle(order.id)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Order #{order.id.slice(0, 8)}</CardTitle>
                <Badge variant={STATUS_VARIANT[order.status]}>{order.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCents(order.subtotalCents, order.currency)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Allowance applied</span>
                <span>-{formatCents(order.allowanceAppliedCents, order.currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Card charged</span>
                <span>{formatCents(order.cardChargedCents, order.currency)}</span>
              </div>

              <button
                onClick={() => toggle(order.id)}
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {isOpen ? "Hide" : "Show"} line items
              </button>

              {isOpen && (
                <div className={cn("flex flex-col gap-1 rounded-md bg-muted p-2")}>
                  {order.lines.map((line) => (
                    <div key={line.id} className="flex justify-between text-xs">
                      <span>
                        {line.variantName} × {line.qty}
                      </span>
                      <span>{formatCents(line.unitPriceCents * line.qty, order.currency)}</span>
                    </div>
                  ))}
                </div>
              )}

              <Link
                href={`/orders/${order.id}`}
                className="flex min-h-11 items-center justify-center gap-1 rounded-md border border-border text-sm font-medium hover:bg-muted"
              >
                View details <ChevronRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
