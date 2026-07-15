import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma client. Connects via DATABASE_URL, which MUST be a
 * non-superuser, non-owner role (`app_user`) so RLS policies are enforced.
 * Never import this to run raw queries outside withTenant() for anything
 * touching tenant-scoped data — the session GUCs RLS depends on are only
 * set inside that helper's transaction.
 */
export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
