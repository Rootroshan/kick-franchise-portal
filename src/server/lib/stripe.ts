import Stripe from "stripe";
import { getSetting } from "@/server/modules/settings/platformSettings";

let client: Stripe | null = null;
let clientKey: string | null = null;

/**
 * Stripe client built from the active secret key.
 *
 * Async because the key may come from the database (entered via admin settings)
 * rather than only the environment. The instance is cached against the key it
 * was built with, so a key changed in the UI takes effect on the next call
 * instead of requiring a redeploy — while unchanged keys still reuse one client.
 */
export async function stripeClient(): Promise<Stripe> {
  const key = await getSetting("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe is not configured. Add a secret key in Settings.");

  if (client && clientKey === key) return client;
  client = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  clientKey = key;
  return client;
}
