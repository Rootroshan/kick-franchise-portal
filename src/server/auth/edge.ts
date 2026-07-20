import NextAuth from "next-auth";

/**
 * Edge-safe NextAuth instance, for middleware only.
 *
 * Middleware runs on the Edge runtime, which has neither Node's crypto nor
 * Prisma. Importing the full config there pulls in the Prisma adapter and
 * argon2 (via node:crypto) and the build fails with UnhandledSchemeError.
 *
 * This instance declares no providers and no adapter: with the JWT session
 * strategy, verifying the session cookie needs only AUTH_SECRET, which is
 * exactly what the middleware does. Sign-in itself is handled by the full
 * config in ./config.ts, which runs in the Node runtime.
 */
export const { auth } = NextAuth({
  providers: [],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    // Mirror the full config so req.auth.user.id is populated identically.
    async session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
});
