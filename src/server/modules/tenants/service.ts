import { randomBytes } from "node:crypto";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { HttpError } from "@/server/modules/identity/errors";
import type { z } from "zod";
import type {
  createTenantSchema,
  updateTenantSchema,
  createLocationSchema,
  createCustomDomainSchema,
  createMembershipSchema,
} from "./schemas";

/** KICK_ADMIN only — tenant/brand provisioning. Instantly gives the brand its own portal (per Dev Brief §2). */
export async function createTenant(ctx: RequestContext, input: z.infer<typeof createTenantSchema>) {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.tenant.findUnique({ where: { slug: input.slug } });
    if (existing) throw new HttpError(409, "A tenant with this slug already exists");

    const tenant = await tx.tenant.create({
      data: {
        name: input.name,
        slug: input.slug,
        clerkOrgId: input.clerkOrgId ?? null,
        theme: input.theme,
      },
    });

    await writeAuditLog(tx, {
      tenantId: tenant.id,
      actorId: ctx.userId,
      role: ctx.role,
      action: "tenant.create",
      entity: "Tenant",
      entityId: tenant.id,
      after: tenant,
    });

    return tenant;
  });
}

export async function updateTenant(ctx: RequestContext, tenantId: string, input: z.infer<typeof updateTenantSchema>) {
  return withTenant(ctx, async (tx) => {
    const before = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!before) throw new HttpError(404, "Tenant not found");

    const after = await tx.tenant.update({
      where: { id: tenantId },
      data: {
        name: input.name,
        status: input.status,
        theme: input.theme ? { ...(before.theme as object), ...input.theme } : undefined,
      },
    });

    await writeAuditLog(tx, {
      tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "tenant.update",
      entity: "Tenant",
      entityId: tenantId,
      before,
      after,
    });

    return after;
  });
}

export async function listTenants(ctx: RequestContext) {
  return withTenant(ctx, (tx) => tx.tenant.findMany({ orderBy: { createdAt: "desc" } }));
}

export async function createLocation(ctx: RequestContext, tenantId: string, input: z.infer<typeof createLocationSchema>) {
  return withTenant(ctx, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new HttpError(404, "Tenant not found");

    const location = await tx.location.create({
      data: { tenantId, name: input.name, address: input.address ?? null },
    });

    await writeAuditLog(tx, {
      tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "location.create",
      entity: "Location",
      entityId: location.id,
      after: location,
    });

    return location;
  });
}

export async function listLocations(ctx: RequestContext, tenantId: string | null) {
  // These three list functions are always scoped to ONE specific tenant
  // (a path param, tenant.id, or the caller's own resolved tenant) — there
  // is no legitimate cross-tenant use case, unlike listProducts/
  // listAnnouncements. So a null tenantId is a programming error, not a
  // "show everything" request: reject it rather than silently running an
  // unfiltered query. RLS would still contain the blast radius to the
  // caller's own tenant, but we don't want to lean on RLS as the only guard.
  if (!tenantId) throw new HttpError(400, "A tenant must be specified");
  return withTenant(ctx, (tx) => tx.location.findMany({ where: { tenantId }, orderBy: { name: "asc" } }));
}

/** Creates a pending custom domain with a DNS TXT verification token (spec §16/§19). */
export async function createCustomDomain(ctx: RequestContext, tenantId: string, input: z.infer<typeof createCustomDomainSchema>) {
  return withTenant(ctx, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new HttpError(404, "Tenant not found");

    const existing = await tx.customDomain.findUnique({ where: { hostname: input.hostname } });
    if (existing) throw new HttpError(409, "This domain is already registered to a tenant");

    const verificationToken = `kick-verify-${randomBytes(16).toString("hex")}`;
    const domain = await tx.customDomain.create({
      data: { tenantId, hostname: input.hostname, verificationToken, status: "PENDING" },
    });

    await writeAuditLog(tx, {
      tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "customDomain.create",
      entity: "CustomDomain",
      entityId: domain.id,
      after: domain,
    });

    return {
      domain,
      dnsInstructions: {
        type: "TXT",
        name: `_kick-verify.${input.hostname}`,
        value: verificationToken,
        cnameTarget: "cname.vercel-dns.com", // Vercel Domains handles ACME/TLS once verified + attached
      },
    };
  });
}

/**
 * Verifies a pending custom domain by checking DNS TXT record resolution.
 * Real DNS lookup requires the `dns` module (Node runtime) — this performs
 * that check and flips status to VERIFIED on success.
 */
export async function verifyCustomDomain(ctx: RequestContext, domainId: string) {
  return withTenant(ctx, async (tx) => {
    const domain = await tx.customDomain.findUnique({ where: { id: domainId } });
    if (!domain) throw new HttpError(404, "Domain not found");
    if (domain.status === "VERIFIED") return domain;

    const { resolveTxt } = await import("node:dns/promises");
    let verified = false;
    try {
      const records = await resolveTxt(`_kick-verify.${domain.hostname}`);
      verified = records.some((chunks) => chunks.join("").trim() === domain.verificationToken);
    } catch {
      verified = false;
    }

    const after = await tx.customDomain.update({
      where: { id: domainId },
      data: {
        status: verified ? "VERIFIED" : "FAILED",
        verifiedAt: verified ? new Date() : null,
      },
    });

    await writeAuditLog(tx, {
      tenantId: domain.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "customDomain.verify",
      entity: "CustomDomain",
      entityId: domainId,
      before: { status: domain.status },
      after: { status: after.status },
    });

    if (!verified) {
      throw new HttpError(422, "DNS TXT record not found or does not match. Verify DNS propagation and try again.");
    }
    return after;
  });
}

export async function listCustomDomains(ctx: RequestContext, tenantId: string | null) {
  if (!tenantId) throw new HttpError(400, "A tenant must be specified");
  return withTenant(ctx, (tx) => tx.customDomain.findMany({ where: { tenantId } }));
}

/** [K,F]: invite/assign a user to this tenant with a role. Franchisor may only invite FRANCHISEE_USER within their own tenant. */
export async function createMembership(ctx: RequestContext, tenantId: string, input: z.infer<typeof createMembershipSchema>) {
  if (ctx.role === "FRANCHISOR_ADMIN" && input.role !== "FRANCHISEE_USER") {
    throw new HttpError(403, "Franchisor admins may only invite franchisee users");
  }
  return withTenant(ctx, async (tx) => {
    if (input.locationId) {
      const location = await tx.location.findUnique({ where: { id: input.locationId } });
      if (!location || location.tenantId !== tenantId) {
        throw new HttpError(422, "Location does not belong to this tenant");
      }
    }

    const membership = await tx.membership.upsert({
      where: { clerkUserId_tenantId: { clerkUserId: input.clerkUserId, tenantId } },
      create: {
        clerkUserId: input.clerkUserId,
        tenantId,
        locationId: input.locationId ?? null,
        role: input.role,
        email: input.email ?? null,
        displayName: input.displayName ?? null,
      },
      update: {
        locationId: input.locationId ?? null,
        role: input.role,
      },
    });

    await writeAuditLog(tx, {
      tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "membership.create",
      entity: "Membership",
      entityId: membership.id,
      after: { role: membership.role, locationId: membership.locationId },
    });

    return membership;
  });
}

export async function listMemberships(ctx: RequestContext, tenantId: string | null) {
  if (!tenantId) throw new HttpError(400, "A tenant must be specified");
  return withTenant(ctx, (tx) => tx.membership.findMany({ where: { tenantId }, include: { location: true } }));
}
