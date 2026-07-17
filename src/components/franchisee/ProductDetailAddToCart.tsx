"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";
import { useCart } from "@/components/franchisee/CartContext";

type Variant = { variantId: string; name: string; priceCents: number; currency: string; inStock: boolean };

/** Product-detail variant list with add-to-cart. Prices shown are server-provided;
 *  checkout re-prices authoritatively so client price is display-only. */
export function ProductDetailAddToCart({ productName, variants }: { productName: string; variants: Variant[] }) {
  const { addItem, items } = useCart();
  const [added, setAdded] = useState<string | null>(null);
  const cartCount = items.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="flex flex-col gap-3">
      {variants.map((v) => (
        <div key={v.variantId} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div>
            <div className="text-sm font-medium">{v.name}</div>
            <div className="text-sm text-muted-foreground">{formatCents(v.priceCents, v.currency)}</div>
          </div>
          <Button
            size="sm"
            className="min-h-11"
            variant={added === v.variantId ? "secondary" : "default"}
            disabled={!v.inStock}
            onClick={() => {
              addItem({ variantId: v.variantId, productName, variantName: v.name, priceCents: v.priceCents });
              setAdded(v.variantId);
              setTimeout(() => setAdded(null), 1200);
            }}
          >
            {!v.inStock ? "Out of stock" : added === v.variantId ? <><Check className="mr-1 h-4 w-4" /> Added</> : "Add to cart"}
          </Button>
        </div>
      ))}

      <Link href="/cart" className="mt-1 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium hover:bg-muted">
        <ShoppingCart className="h-4 w-4" /> View cart ({cartCount})
      </Link>
    </div>
  );
}
