import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
  "/manifest.webmanifest",
  "/sw.js",
  "/icons/(.*)",
]);

/**
 * Resolves the request's tenant from the Host header and forwards it as a
 * trusted header (`x-kick-host`) for the identity module to re-resolve
 * server-side. We do NOT resolve tenantId/role here and trust it downstream —
 * middleware runs on the Edge runtime without Prisma access, so the actual
 * tenant lookup + RBAC happens in getRequestContext() on every request. This
 * middleware only handles auth gating and passes the raw host through.
 */
export default clerkMiddleware(async (authFn, req: NextRequest) => {
  if (!isPublicRoute(req)) {
    await authFn.protect();
  }

  const res = NextResponse.next();
  res.headers.set("x-kick-host", req.headers.get("host") ?? "");
  return res;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
