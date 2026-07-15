import { prisma } from "@/server/db/client";
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
  const hostname = host.split(":")[0]?.toLowerCase().trim();
  if (!hostname) return null;

  const baseDomain = (process.env.APP_BASE_DOMAIN ?? "").toLowerCase();

  // Wildcard subdomain match: <slug>.<baseDomain>
  if (baseDomain && hostname.endsWith(`.${baseDomain}`)) {
    const slug = hostname.slice(0, -(`.${baseDomain}`.length));
    if (slug && !slug.includes(".")) {
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (tenant && tenant.status === "active") {
        return { id: tenant.id, slug: tenant.slug, name: tenant.name, theme: tenant.theme, status: tenant.status };
      }
      return null;
    }
  }

  // Custom domain match — must be VERIFIED to resolve.
  const custom = await prisma.customDomain.findUnique({
    where: { hostname },
    include: { tenant: true },
  });
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
