import { headers } from "next/headers";
import { BrandedLoginShell } from "@/components/auth/BrandedLoginShell";

// Branding depends on the request Host, so this can never be prerendered.
export const dynamic = "force-dynamic";

/**
 * Franchise Admin sign-in — one brand-agnostic route, every custom portal
 * domain resolves its own tenant here via the Host header. Role is fixed to
 * FRANCHISOR_ADMIN; there is no selector, so a Store User cannot sign in
 * through this route regardless of what they submit — see
 * server/auth/loginValidation.ts for the server-side enforcement.
 */
export default async function AdminLoginPage() {
  // x-kick-host first: the middleware rewrites the custom domain root to this
  // page and forwards the ORIGINAL host there. Reading `host` alone would see
  // the rewritten request and fail to resolve the tenant.
  const hdrs = await headers();
  const host = hdrs.get("x-kick-host") || hdrs.get("host") || "";

  return (
    <BrandedLoginShell
      host={host}
      role="FRANCHISOR_ADMIN"
      heading="Sign in to Volt Studios Admin"
      description="Manage your franchise locations, announcements, artwork, tasks and onboarding."
    />
  );
}
