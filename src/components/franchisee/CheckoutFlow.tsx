"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Loader2, Wallet } from "lucide-react";
import { useCart } from "@/components/franchisee/CartContext";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCents } from "@/lib/utils";

type CheckoutResult = {
  orderId: string;
  status: string;
  subtotalCents: number;
  allowanceAppliedCents: number;
  cardChargedCents: number;
  clientSecret: string | null;
};

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

function currentPeriodLabel(date = new Date()): string {
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

/**
 * Two-step checkout: review (items, subtotal, allowance estimate) → place
 * order → card payment when a remainder exists. All amounts shown pre-order
 * are estimates; the server re-prices, applies ordering rules, and locks the
 * allowance inside one transaction at POST /api/orders/checkout.
 */
export function CheckoutFlow() {
  const { items, clear, subtotalCents } = useCart();
  const router = useRouter();
  // Generated ONCE per checkout attempt — never regenerated on re-render, reused across retries.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  // Current-period balance only — that's what checkout can actually spend.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/allowances/me", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        const period = currentPeriodLabel();
        const current = (data.balances ?? []).filter((b: { periodLabel: string }) => b.periodLabel === period);
        setBalanceCents(current.reduce((sum: number, b: { balanceCents: number }) => sum + Math.max(0, b.balanceCents), 0));
      })
      .catch(() => setBalanceCents(null));
    return () => controller.abort();
  }, []);

  async function placeOrder() {
    if (placing) return; // repeated clicks can't double-submit
    setPlacing(true);
    setError(null);
    try {
      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      setResult(data as CheckoutResult);
      if (!data.clientSecret) {
        // Fully covered by allowance — already PAID. Clear and confirm.
        clear();
        router.push(`/checkout/success?order=${data.orderId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0 && !result) {
    return <p className="text-sm text-muted-foreground">Your cart is empty.</p>;
  }

  // Step 2: card payment for the server-calculated remainder.
  if (result?.clientSecret) {
    return (
      <Elements stripe={getStripe()} options={{ clientSecret: result.clientSecret }}>
        <CardPaymentStep result={result} onPaid={clear} />
      </Elements>
    );
  }

  if (result) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Confirming your order…
      </p>
    );
  }

  // Step 1: review.
  const estimatedApplied = balanceCents !== null ? Math.min(balanceCents, subtotalCents) : null;
  const estimatedRemainder = estimatedApplied !== null ? subtotalCents - estimatedApplied : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          {items.map((item) => (
            <div key={item.variantId} className="flex justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                {item.productName} · {item.variantName} × {item.qty}
              </span>
              <span className="tabular-nums">{formatCents(item.priceCents * item.qty)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-border pt-2 text-sm font-semibold">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCents(subtotalCents)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1.5 p-4 text-sm">
          <div className="flex justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Wallet className="h-4 w-4" aria-hidden="true" /> Available allowance
            </span>
            <span className="tabular-nums">{balanceCents !== null ? formatCents(balanceCents) : "Loading…"}</span>
          </div>
          {estimatedApplied !== null && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>Allowance applied (estimate)</span>
                <span className="tabular-nums">− {formatCents(estimatedApplied)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Card charge (estimate)</span>
                <span className="tabular-nums">{formatCents(estimatedRemainder!)}</span>
              </div>
            </>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Final amounts are calculated securely by the server when you place the order.
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-status-error/30 bg-status-error/5 px-3 py-2 text-sm text-status-error" role="alert">
          {error}
        </div>
      )}

      <Button size="lg" className="min-h-12" disabled={placing} onClick={placeOrder}>
        {placing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Processing your order…
          </>
        ) : (
          "Place order"
        )}
      </Button>
      <Button variant="secondary" disabled={placing} onClick={() => router.push("/cart")}>
        Back to cart
      </Button>
    </div>
  );
}

function CardPaymentStep({ result, onPaid }: { result: CheckoutResult; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setPaymentError(null);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/checkout/success?order=${result.orderId}` },
      redirect: "if_required",
    });
    if (error) {
      setPaymentError(error.message || "Payment failed");
      setSubmitting(false);
      return;
    }
    onPaid();
    router.push(`/checkout/success?order=${result.orderId}`);
  }

  return (
    <form onSubmit={confirm} className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatCents(result.subtotalCents)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Allowance applied</span>
            <span className="tabular-nums">− {formatCents(result.allowanceAppliedCents)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span>Card charge</span>
            <span className="tabular-nums">{formatCents(result.subtotalCents - result.allowanceAppliedCents)}</span>
          </div>
          <PaymentElement />
          {paymentError && (
            <p className="text-sm text-status-error" role="alert">
              {paymentError}
            </p>
          )}
        </CardContent>
      </Card>
      <Button type="submit" size="lg" className="min-h-12" disabled={!stripe || submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Confirming payment…
          </>
        ) : (
          "Pay now"
        )}
      </Button>
      <a href={`/checkout/success?order=${result.orderId}`} className={cn(buttonVariants({ variant: "secondary" }), "justify-center")}>
        View confirmation
      </a>
    </form>
  );
}
