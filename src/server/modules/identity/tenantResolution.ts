import { withTenant, systemKickContext } from "@/server/db/withTenant";
import { HttpError } from "./errors";

export type ResolvedTenant = {
  id: string;
  name: string;
  theme: unknown;
  status: string;
};

/**
 * Resolves a tenant exclusively from its verified portal hostname.
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

export type HostDiagnosis =
  | { kind: "unknown" }
  | { kind: "pending_verification"; brandName: string }
  | { kind: "tenant_inactive"; brandName: string };

/**
 * Distinguishes WHY a host didn't resolve, for the "not available" page to
 * show the right message — a domain that's registered but not yet verified
 * needs "DNS setup isn't finished," not the same generic message as a host
 * nobody has ever heard of. Only ever called after resolveTenantFromHost()
 * already returned null; never used to grant access.
 */
export async function diagnoseUnresolvedHost(host: string): Promise<HostDiagnosis> {
  const hostname = host
    .split(":")[0]
    ?.toLowerCase()
    .trim()
    .replace(/^www\./, "");
  if (!hostname) return { kind: "unknown" };

  const custom = await withTenant(systemKickContext(), (tx) =>
    tx.customDomain.findUnique({ where: { hostname }, include: { tenant: true } })
  ).catch(() => null);

  if (!custom) return { kind: "unknown" };
  if (custom.tenant.status !== "active") return { kind: "tenant_inactive", brandName: custom.tenant.name };
  if (custom.status !== "VERIFIED") return { kind: "pending_verification", brandName: custom.tenant.name };
  // A CustomDomain row that's VERIFIED with an active tenant should have
  // resolved successfully — reaching here means resolveTenantFromHost's own
  // check disagreed (e.g. a race), which is unexpected but still "unknown"
  // from the visitor's perspective rather than a state this function names.
  return { kind: "unknown" };
}
