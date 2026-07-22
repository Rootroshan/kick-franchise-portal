"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/components/franchisee/CartContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Trash2 } from "lucide-react";
import { formatCents } from "@/lib/utils";

export default function CartPage() {
  const { items, setQty, removeItem, clear, subtotalCents } = useCart();
  const router = useRouter();
  const [balanceCents, setBalanceCents] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/allowances/me", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        const total = (data.balances ?? []).reduce((sum: number, b: { balanceCents: number }) => sum + b.balanceCents, 0);
        setBalanceCents(total);
      })
      .catch(() => setBalanceCents(null));
    return () => controller.abort();
  }, []);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <ShoppingCart className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Link href="/shop" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Go to Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Cart</h1>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-status-error"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Clear cart
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <Card key={item.variantId}>
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">{item.variantName}</p>
                <p className="text-sm text-muted-foreground">{formatCents(item.priceCents)} each</p>
              </div>
              <Input
                type="number"
                min={1}
                aria-label={`Quantity for ${item.productName} ${item.variantName}`}
                value={item.qty}
                onChange={(e) => setQty(item.variantId, Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-16 text-center"
              />
              <div className="w-20 text-right text-sm font-semibold tabular-nums">{formatCents(item.priceCents * item.qty)}</div>
              <button aria-label={`Remove ${item.productName}`} onClick={() => removeItem(item.variantId)} className="text-muted-foreground hover:text-status-error">
                <Trash2 className="h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-1 p-4">
          <div className="flex justify-between text-sm">
            <span>Subtotal (estimate)</span>
            <span className="tabular-nums">{formatCents(subtotalCents)}</span>
          </div>
          {balanceCents !== null && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Allowance balance</span>
              <span className="tabular-nums">{formatCents(balanceCents)}</span>
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            This total is an estimate for display only. The final price is calculated by the server at checkout.
          </p>
        </CardContent>
      </Card>

      <Button size="lg" onClick={() => router.push("/checkout")}>
        Checkout
      </Button>
      <Link href="/shop" className="flex min-h-11 items-center justify-center rounded-lg border border-border text-sm font-medium hover:bg-muted">
        Continue shopping
      </Link>
    </div>
  );
}
