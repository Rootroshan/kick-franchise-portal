import Stripe from "stripe";
import { getEnv } from "@/lib/env";

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  if (client) return client;
  const env = getEnv();
  client = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
  return client;
}
