import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Edge-safe instance: the full config pulls in Prisma and argon2 (node:crypto),
// which the Edge runtime cannot bundle. See src/server/auth/edge.ts.
import { auth } from "@/server/auth/edge";

const PUBLIC_PATTERNS: RegExp[] = [
  /^\/sign-in(\/.*)?$/,
  // Public registration was deliberately removed: this is an invite-only admin
  // platform, so a self-serve /sign-up let anyone create an account. Accounts
  // are provisioned directly and granted a role via Membership.
  //
  // These must be public — no session exists yet when they load.
  /^\/forgot-password$/,
  /^\/api\/auth(\/.*)?$/, // NextAuth's own callback/session/CSRF endpoints
  // Must be public: it clears the session cookie and redirects to sign-in.
  // Gating it behind auth would bounce an already-expired session away before
  // the cookie could be cleared.
  /^\/sign-out$/,
  /^\/api\/webhooks(\/.*)?$/,
  /^\/manifest\.webmanifest$/,
  /^\/sw\.js$/,
  /^\/icons(\/.*)?$/,
];

function isPublicRoute(req: NextRequest): boolean {
  const path = req.nextUrl.pathname;
  return PUBLIC_PATTERNS.some((re) => re.test(path));
}

// DEV-ONLY: only reachable with DEV_BYPASS_AUTH=true AND NODE_ENV=development
// (see requestContext.ts's matching guard) — never set DEV_BYPASS_AUTH outside
// a local .env.local file.
const devBypassEnabled = process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "true";

function withHostHeader(req: NextRequest, opts: { authenticated?: boolean } = {}): NextResponse {
  const res = NextResponse.next();
  res.headers.set("x-kick-host", req.headers.get("host") ?? "");

  // Authenticated pages must never be cached by the browser. Without this the
  // back button can re-render a signed-in page from bfcache after logout — the
  // session is already gone, but the stale HTML still displays. Set here rather
  // than per-page so every current and future protected route is covered.
  if (opts.authenticated) {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.headers.set("Pragma", "no-cache");
  }

  return res;
}

/**
 * Resolves the request's tenant from the Host header and forwards it as a
 * trusted header (`x-kick-host`) for the identity module to re-resolve
 * server-side. We do NOT resolve tenantId/role here and trust it downstream —
 * middleware only gates authentication; the tenant lookup and RBAC happen in
 * getRequestContext() on every request.
 *
 * A signed-out user hitting a protected route is REDIRECTED to /sign-in with
 * the intended destination preserved. This also covers an invalidated session:
 * the JWT cookie is verified on every request, so once /sign-out clears it,
 * every protected page and API route falls into this branch.
 */
export default devBypassEnabled
  ? function devMiddleware(req: NextRequest) {
      return withHostHeader(req);
    }
  : auth((req) => {
      const isProtected = !isPublicRoute(req);
      if (isProtected && !req.auth?.user?.id) {
        const url = new URL("/sign-in", req.nextUrl.origin);
        url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(url);
      }
      return withHostHeader(req, { authenticated: isProtected });
    }) as unknown as (req: NextRequest) => NextResponse | Promise<NextResponse>;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
