import { handlers } from "@/server/auth/config";

// NextAuth's OAuth callback, session and CSRF endpoints. Public — see
// middleware isPublicRoute — because no session exists during sign-in.
//
// Must be forced to the Node runtime: this route's config pulls in argon2
// (native binary, node:crypto) and Prisma, neither of which the Edge runtime
// supports. Without this, Next/Vercel bundled the route as edge-middleware,
// where argon2's node-gyp-build resolution fails with
// "No native build was found" for every request — 500s on every
// /api/auth/* call before any credentials are even submitted.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
