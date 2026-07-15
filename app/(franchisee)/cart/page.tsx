"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/components/franchisee/CartContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { formatCents } from "@/lib/utils";

export default function CartPage() {
  const { items, setQty, removeItem, subtotalCents } = useCart();
  const router = useRouter();
  const [balanceCents, setBalanceCents] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/allowances/me")
      .then((res) => res.json())
      .then((data) => {
        const total = (data.balances ?? []).reduce((sum: number, b: { balanceCents: number }) => sum + b.balanceCents, 0);
        setBalanceCents(total);
      })
      .catch(() => setBalanceCents(null));
  }, []);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Link href="/shop" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Go to Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Cart</h1>

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <Card key={item.variantId}>
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">{item.variantName}</p>
                <p className="text-sm">{formatCents(item.priceCents)} each</p>
              </div>
              <Input
                type="number"
                min={1}
                value={item.qty}
                onChange={(e) => setQty(item.variantId, Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-16 text-center"
              />
              <button aria-label="Remove" onClick={() => removeItem(item.variantId)} className="text-muted-foreground">
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
            <span>{formatCents(subtotalCents)}</span>
          </div>
          {balanceCents !== null && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Allowance balance</span>
              <span>{formatCents(balanceCents)}</span>
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
    </div>
  );
}
