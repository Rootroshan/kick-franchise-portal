import { withTenant, systemKickContext } from "@/server/db/withTenant";
import { HttpError } from "./errors";

export type ResolvedTenant = {
  id: string;
  slug: string;
  name: string;
  theme: unknown;
  status: string;
};

/**
 * Resolves the tenant from the request Host header: either the wildcard
 * subdomain (`brandx.portal.kickmedia.com` -> slug `brandx`) or a verified
 * custom domain. This runs on every request via middleware.ts.
 */
export async function resolveTenantFromHost(host: string): Promise<ResolvedTenant | null> {
  // Strip port and a leading "www." — an owner pointing www.portal.brand.com
  // at the same CNAME must resolve identically to the bare host, matching the
  // same normalisation middleware.ts applies before classifying the request.
  const hostname = host
    .split(":")[0]
    ?.toLowerCase()
    .trim()
    .replace(/^www\./, "");
  if (!hostname) return null;

  const baseDomain = (process.env.APP_BASE_DOMAIN ?? "").toLowerCase();

  // Wildcard subdomain match: <slug>.<baseDomain>
  if (baseDomain && hostname.endsWith(`.${baseDomain}`)) {
    const slug = hostname.slice(0, -(`.${baseDomain}`.length));
    if (slug && !slug.includes(".")) {
      // Runs before any role/tenant context is known (this IS how tenant is
      // resolved), so it must use system/KICK_ADMIN authority to pass RLS —
      // Tenant has FORCE ROW LEVEL SECURITY with no anonymous-read policy.
      const tenant = await withTenant(systemKickContext(), (tx) => tx.tenant.findUnique({ where: { slug } }));
      if (tenant && tenant.status === "active") {
        return { id: tenant.id, slug: tenant.slug, name: tenant.name, theme: tenant.theme, status: tenant.status };
      }
      return null;
    }
  }

  // Custom domain match — must be VERIFIED to resolve.
  let custom;
  try {
    custom = await withTenant(systemKickContext(), (tx) =>
      tx.customDomain.findUnique({
        where: { hostname },
        include: { tenant: true },
      })
    );
  } catch (err) {
    // A thrown query and "no such domain" both ended up as a silent null,
    // which made a connection failure indistinguishable from an unknown host.
    console.error(`[tenantResolution] lookup failed for "${hostname}":`, err);
    return null;
  }

  if (!custom) {
    console.warn(`[tenantResolution] no CustomDomain row for "${hostname}"`);
  } else if (custom.status !== "VERIFIED" || custom.tenant.status !== "active") {
    console.warn(
      `[tenantResolution] "${hostname}" found but not servable: domain=${custom.status} tenant=${custom.tenant.status}`
    );
  }

  if (custom && custom.status === "VERIFIED" && custom.tenant.status === "active") {
    return {
      id: custom.tenant.id,
      slug: custom.tenant.slug,
      name: custom.tenant.name,
      theme: custom.tenant.theme,
      status: custom.tenant.status,
    };
  }

  return null;
}

export function requireResolvedTenant(tenant: ResolvedTenant | null): ResolvedTenant {
  if (!tenant) {
    throw new HttpError(404, "Unknown tenant for this host");
  }
  return tenant;
}
