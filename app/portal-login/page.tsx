import { headers } from "next/headers";
import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import { resolveTenantFromHost } from "@/server/modules/identity/tenantResolution";
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
 * and render the notice below rather than a login form: offering a form for a
 * brand that does not exist would invite credential stuffing against it.
 */
export default async function PortalLoginPage() {
  const host = (await headers()).get("host") ?? "";
  const tenant = await resolveTenantFromHost(host);

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-warning/10">
            <AlertTriangle className="h-5 w-5 text-status-warning" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold">Portal not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This portal address is not recognised, or its domain has not finished verification. Check the web address,
            or contact your brand administrator.
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
