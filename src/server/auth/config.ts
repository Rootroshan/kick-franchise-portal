import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authPrisma } from "@/server/db/authClient";
import { verifyPassword } from "./password";

/**
 * NextAuth (Auth.js v5) configuration — replaces Clerk.
 *
 * Session strategy is "jwt", not "database". The adapter still persists users
 * and OAuth accounts, but sessions live in a signed HTTP-only cookie so the
 * middleware can authorise on the Edge without a DB round trip per request.
 *
 * IMPORTANT: signing in does NOT grant access. Authorisation comes from the
 * Membership table (see requestContext.ts) — a Google user with no Membership
 * row has a valid session and no permissions.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(authPrisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  trustHost: true,

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),

    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
        const password = typeof raw?.password === "string" ? raw.password : "";
        if (!email || !password) return null;

        const user = await authPrisma.user.findUnique({ where: { email } });

        // Returning null for every failure — unknown email, OAuth-only account,
        // wrong password, deactivated — keeps the caller unable to distinguish
        // them, which would otherwise reveal which addresses are registered.
        if (!user?.passwordHash || !user.isActive) return null;
        if (!(await verifyPassword(user.passwordHash, password))) return null;

        await authPrisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],

  callbacks: {
    /**
     * Runs for every sign-in, including OAuth. Deactivated users are rejected
     * here so a Google login cannot bypass the isActive check that the
     * credentials provider enforces.
     */
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase();
        if (!email) return false;
        const existing = await authPrisma.user.findUnique({ where: { email } });
        // Unknown Google users are allowed to create an account; they simply
        // have no Membership and therefore no access to anything.
        if (existing && !existing.isActive) return false;
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },

    async session({ session, token }) {
      // requestContext.ts reads session.user.id to look up Membership, so it
      // must carry the User.id rather than the default email-keyed identity.
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
});
