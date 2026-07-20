import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __authPrisma: PrismaClient | undefined;
}

/**
 * Dedicated Prisma client for authentication only.
 *
 * The auth tables (User/Account/Session/VerificationToken) carry a deny-all RLS
 * policy for the application role — nothing in the request path should ever be
 * able to read a password hash or a live session token. NextAuth still has to
 * read them, so it connects via DIRECT_URL, which uses the privileged role that
 * owns the schema and is not subject to those policies.
 *
 * Use this ONLY for NextAuth. Every other query must go through withTenant() so
 * RLS applies.
 */
export const authPrisma =
  global.__authPrisma ??
  new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL } },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") global.__authPrisma = authPrisma;
