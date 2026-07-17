"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
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

export function CheckoutFlow() {
  const { items, clear } = useCart();
  const router = useRouter();
  // Generated ONCE per checkout attempt — never regenerated on re-render, reused across retries.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || items.length === 0) return;
    startedRef.current = true;
    setLoading(true);
    fetch("/api/orders/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
        idempotencyKey: idempotencyKeyRef.current,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Checkout failed");
        return data as CheckoutResult;
      })
      .then((data) => {
        setResult(data);
        if (!data.clientSecret) clear(); // fully covered by allowance — already PAID
      })
      .catch((err) => setError(err.message || "Checkout failed"))
      .finally(() => setLoading(false));
    // items/clear intentionally excluded — this must run exactly once per mount, not react to cart mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0 && !result) {
    return <p className="text-sm text-muted-foreground">Your cart is empty.</p>;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="secondary" onClick={() => router.push("/cart")}>
            Back to cart
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading || !result) {
    return <p className="text-sm text-muted-foreground">Placing your order…</p>;
  }

  if (!result.clientSecret) {
    return <PaidSuccess result={result} />;
  }

  return (
    <Elements stripe={getStripe()} options={{ clientSecret: result.clientSecret }}>
      <CardPaymentStep result={result} onPaid={clear} />
    </Elements>
  );
}

function PaidSuccess({ result }: { result: CheckoutResult }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <p className="text-lg font-semibold">Order placed</p>
        <p className="text-sm text-muted-foreground">Order #{result.orderId.slice(0, 8)}</p>
        <p className="text-sm">Subtotal: {formatCents(result.subtotalCents)}</p>
        <p className="text-sm">Allowance applied: {formatCents(result.allowanceAppliedCents)}</p>
        <a href={`/checkout/success?order=${result.orderId}`} className={cn(buttonVariants(), "justify-center")}>
          View confirmation
        </a>
      </CardContent>
    </Card>
  );
}

function CardPaymentStep({ result, onPaid }: { result: CheckoutResult; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

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
    setPaid(true);
    onPaid();
  }

  if (paid) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <p className="text-lg font-semibold">Payment confirmed</p>
          <p className="text-sm text-muted-foreground">Order #{result.orderId.slice(0, 8)}</p>
          <a href={`/checkout/success?order=${result.orderId}`} className={cn(buttonVariants(), "justify-center")}>
            View confirmation
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={confirm} className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <p className="text-sm">Allowance applied: {formatCents(result.allowanceAppliedCents)}</p>
          <p className="text-sm font-medium">Card charge: {formatCents(result.subtotalCents - result.allowanceAppliedCents)}</p>
          <PaymentElement />
          {paymentError && <p className="text-sm text-destructive">{paymentError}</p>}
        </CardContent>
      </Card>
      <Button type="submit" disabled={!stripe || submitting}>
        {submitting ? "Processing…" : "Pay now"}
      </Button>
    </form>
  );
}
