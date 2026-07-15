import { vi } from "vitest";

/**
 * Mocks @clerk/nextjs/server's auth() and next/headers' headers() so
 * requireRole()/getRequestContext() can be exercised directly against real
 * Postgres/RLS without a running Next.js server (which owns the
 * AsyncLocalStorage those modules depend on in production).
 *
 * Must be called via vi.mock at the top of a test file, BEFORE importing
 * anything that transitively imports requestContext.ts.
 */
export function installAuthMocks(state: { userId: string | null; host: string }) {
  vi.mock("@clerk/nextjs/server", () => ({
    auth: async () => ({ userId: state.userId }),
  }));
  vi.mock("next/headers", () => ({
    headers: async () => new Map([["host", state.host]]) as unknown as Headers,
  }));
}
