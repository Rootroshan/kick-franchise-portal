"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";
import { useCart } from "@/components/franchisee/CartContext";

type Variant = { variantId: string; name: string; priceCents: number; currency: string; stock: number | null };

const LOW_STOCK_THRESHOLD = 5;

/**
 * Variant picker + quantity selector + add-to-cart. Prices shown are
 * server-provided and display-only; checkout re-prices authoritatively.
 * min/max quantity come from this store's ordering rules — the same rules are
 * re-validated server-side at checkout, this just gives friendly guardrails.
 */
export function ProductDetailAddToCart({
  productName,
  variants,
  minQty = 1,
  maxQty = null,
}: {
  productName: string;
  variants: Variant[];
  minQty?: number;
  maxQty?: number | null;
}) {
  const { addItem, items } = useCart();
  const firstAvailable = variants.find((v) => v.stock === null || v.stock > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstAvailable?.variantId);
  const [qty, setQty] = useState(minQty);
  const [added, setAdded] = useState(false);
  const cartCount = items.reduce((s, i) => s + i.qty, 0);

  const selected = variants.find((v) => v.variantId === selectedId);
  const inStock = selected ? selected.stock === null || selected.stock > 0 : false;
  // Cap at tracked stock as well as the ordering-rule max; the server re-checks both.
  const effectiveMax = Math.min(maxQty ?? Infinity, selected?.stock ?? Infinity);

  const clampQty = (value: number) => Math.max(minQty, Math.min(Number.isFinite(effectiveMax) ? effectiveMax : value, value));

  function handleAdd() {
    if (!selected || !inStock) return;
    addItem({ variantId: selected.variantId, productName, variantName: selected.name, priceCents: selected.priceCents }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Variant picker */}
      <div role="radiogroup" aria-label="Choose a variant" className="flex flex-col gap-2">
        {variants.map((v) => {
          const out = v.stock !== null && v.stock <= 0;
          const isSelected = v.variantId === selectedId;
          return (
            <button
              key={v.variantId}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={out}
              onClick={() => {
                setSelectedId(v.variantId);
                setQty((q) => Math.max(minQty, Math.min(q, v.stock ?? Infinity)));
              }}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
              }`}
            >
              <div>
                <div className="text-sm font-medium">{v.name}</div>
                <div className="text-xs text-muted-foreground">
                  {out
                    ? "Out of stock"
                    : v.stock !== null && v.stock <= LOW_STOCK_THRESHOLD
                      ? `Only ${v.stock} item${v.stock === 1 ? "" : "s"} remain in stock`
                      : "In stock"}
                </div>
              </div>
              <div className="text-sm font-semibold tabular-nums">{formatCents(v.priceCents, v.currency)}</div>
            </button>
          );
        })}
      </div>

      {/* Quantity + price */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center rounded-lg border border-border">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={qty <= minQty}
            onClick={() => setQty((q) => clampQty(q - 1))}
            className="flex h-11 w-11 items-center justify-center disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-semibold tabular-nums" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={qty >= effectiveMax}
            onClick={() => setQty((q) => clampQty(q + 1))}
            className="flex h-11 w-11 items-center justify-center disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-bold tabular-nums">
            {selected ? formatCents(selected.priceCents * qty, selected.currency) : "—"}
          </div>
        </div>
      </div>

      <Button size="lg" className="min-h-12" disabled={!selected || !inStock} onClick={handleAdd}>
        {!inStock ? (
          "Out of stock"
        ) : added ? (
          <>
            <Check className="mr-1 h-4 w-4" /> Added to cart
          </>
        ) : (
          "Add to cart"
        )}
      </Button>

      <Link
        href="/cart"
        className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
      >
        <ShoppingCart className="h-4 w-4" /> View cart ({cartCount})
      </Link>
    </div>
  );
}
