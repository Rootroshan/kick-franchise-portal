import { vi } from "vitest";

/**
 * Mocks NextAuth's auth() and next/headers' headers() so
 * requireRole()/getRequestContext() can be exercised directly against real
 * Postgres/RLS without a running Next.js server (which owns the
 * AsyncLocalStorage those modules depend on in production).
 *
 * auth() returns a Session shape — requestContext.ts reads session.user.id.
 *
 * Must be called via vi.mock at the top of a test file, BEFORE importing
 * anything that transitively imports requestContext.ts.
 */
export function installAuthMocks(state: { userId: string | null; host: string }) {
  vi.mock("@/server/auth/config", () => ({
    auth: async () => (state.userId ? { user: { id: state.userId } } : null),
  }));
  vi.mock("next/headers", () => ({
    headers: async () => new Map([["host", state.host]]) as unknown as Headers,
  }));
}
