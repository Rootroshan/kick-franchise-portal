import { headers } from "next/headers";
import Image from "next/image";
import { AlertTriangle, Clock } from "lucide-react";
import { resolveTenantFromHost, diagnoseUnresolvedHost } from "@/server/modules/identity/tenantResolution";
import { parseTenantTheme } from "@/lib/theme";
import { PortalLoginForm } from "@/components/auth/PortalLoginForm";

// Branding depends on the request Host, so this can never be prerendered.
export const dynamic = "force-dynamic";

/**
 * Shared brand portal login.
 *
 * One page serves every franchise brand. The tenant is resolved from the Host
 * header — wildcard subdomain or verified custom domain — so nothing about the
 * brand is hard-coded and a client cannot aim the page at another tenant.
 *
 * Unknown hosts, unverified domains and inactive tenants all resolve to null
 * and render a notice rather than a login form: offering a form for a brand
 * that does not exist would invite credential stuffing against it. The
 * message differs by WHY it failed (diagnoseUnresolvedHost) purely for
 * clarity to whoever is looking at the domain — it never grants access; the
 * access decision is entirely resolveTenantFromHost's null/non-null result.
 */
export default async function PortalLoginPage() {
  // x-kick-host first: the middleware rewrites the custom domain root to this
  // page and forwards the ORIGINAL host there. Reading `host` alone would see
  // the rewritten request and fail to resolve the tenant.
  const hdrs = await headers();
  const host = hdrs.get("x-kick-host") || hdrs.get("host") || "";
  const tenant = await resolveTenantFromHost(host);

  if (!tenant) {
    const diagnosis = await diagnoseUnresolvedHost(host);

    if (diagnosis.kind === "pending_verification") {
      return (
        <div className="flex min-h-screen items-center justify-center bg-app-bg p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-info/10">
              <Clock className="h-5 w-5 text-status-info" aria-hidden="true" />
            </span>
            <h1 className="text-lg font-semibold">Domain setup in progress</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong className="text-foreground">{diagnosis.brandName}</strong>&rsquo;s portal domain is registered but
              hasn&rsquo;t finished DNS verification yet. This usually resolves within a few minutes of the DNS records
              being added — check back shortly, or contact your brand administrator if this persists.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-warning/10">
            <AlertTriangle className="h-5 w-5 text-status-warning" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold">Portal not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {diagnosis.kind === "tenant_inactive"
              ? `${diagnosis.brandName}'s portal is not currently active. Contact your brand administrator.`
              : "This portal address is not recognised. Check the web address, or contact your brand administrator."}
          </p>
        </div>
      </div>
    );
  }

  const theme = parseTenantTheme(tenant.theme);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-app-bg p-4"
      // Scoped here as well as in the root layout so the form's primary-colour
      // styling is correct even on a bare render of this route.
      style={
        {
          "--tenant-primary": theme.primary,
          "--tenant-secondary": theme.secondary,
          fontFamily: `${theme.font}, system-ui, sans-serif`,
        } as React.CSSProperties
      }
    >
      <div className="mb-8 flex flex-col items-center gap-3">
        {theme.logoUrl ? (
          // Brand-supplied logo. Dimensions are fixed and object-contain so an
          // unexpected aspect ratio cannot blow out the layout.
          <Image
            src={theme.logoUrl}
            alt={tenant.name}
            width={180}
            height={64}
            className="h-16 w-auto max-w-[180px] object-contain"
            unoptimized
          />
        ) : (
          <span
            className="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-black text-white"
            style={{ backgroundColor: theme.primary }}
          >
            {tenant.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="text-sm font-semibold text-muted-foreground">{tenant.name}</span>
      </div>

      <PortalLoginForm brandName={tenant.name} />

      <p className="mt-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {tenant.name}. Powered by KICK Media Group.
      </p>
    </div>
  );
}
