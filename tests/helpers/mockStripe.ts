import { vi } from "vitest";

/**
 * Stripe is the one dependency we mock in the money suite — unlike Postgres/RLS,
 * a real Stripe call would require live network access and real API keys.
 * The allowance math, ordering-rule enforcement, and row-locking concurrency
 * logic under test are all Postgres-side and unaffected by this mock.
 */
export function installStripeMock() {
  vi.mock("@/server/lib/stripe", () => ({
    stripeClient: () => ({
      paymentIntents: {
        create: vi.fn(async (params: { amount: number; currency: string }) => ({
          id: `pi_test_${Math.random().toString(36).slice(2)}`,
          client_secret: `pi_test_secret_${Math.random().toString(36).slice(2)}`,
          amount: params.amount,
          currency: params.currency,
          amount_received: params.amount,
        })),
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    }),
  }));
}
