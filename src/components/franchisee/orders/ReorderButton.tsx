"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/franchisee/CartContext";
import { InlineLoader } from "@/components/ui/InlineLoader";

/**
 * Reorder: asks the server to re-validate the old order's lines against the
 * current catalog (current prices, stock, active state), adds what's still
 * orderable to the cart, clearly reports what isn't, then goes to the cart —
 * never straight to checkout.
 */
export function ReorderButton({ orderId }: { orderId: string }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function reorder() {
    setPending(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/reorder`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not prepare this reorder");
      }
      const { available, unavailable } = (await res.json()) as {
        available: Array<{ variantId: string; productName: string; variantName: string; priceCents: number; qty: number }>;
        unavailable: Array<{ productName: string; variantName: string; reason: string }>;
      };

      if (available.length === 0) {
        toast.error("None of these products are available any more.");
        return;
      }
      for (const item of available) {
        addItem({ variantId: item.variantId, productName: item.productName, variantName: item.variantName, priceCents: item.priceCents }, item.qty);
      }
      toast.success(`${available.length} item${available.length === 1 ? "" : "s"} added to your cart at current prices.`);
      for (const missing of unavailable) {
        toast.warning(`${missing.productName} (${missing.variantName}): ${missing.reason}`);
      }
      router.push("/cart");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not prepare this reorder");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={reorder}
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {pending ? <InlineLoader label="Preparing reorder…" /> : <><RotateCcw className="h-4 w-4" aria-hidden="true" /> Reorder</>}
    </button>
  );
}
