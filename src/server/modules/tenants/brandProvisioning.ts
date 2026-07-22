import { randomBytes, randomUUID } from "node:crypto";
import { resolveCname } from "node:dns/promises";
import type { z } from "zod";
import { authPrisma } from "@/server/db/authClient";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { createInvitation } from "@/server/auth/invitations";
import { createPresignedUploadUrl, storageObjectExists, uploadObjectDirect } from "@/server/lib/storage";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { HttpError } from "@/server/modules/identity/errors";
import { normaliseHostname, verificationRecordName } from "./domainNormalise";
import { attachDomain, cnameTarget, isHostingConfigured } from "./hostingProvider";
import type { createBrandSchema } from "./schemas";

export async function checkPortalDomain(ctx: RequestContext, rawDomain: string) {
  const normalised = normaliseHostname(rawDomain);
  if (!normalised.ok) throw new HttpError(400, normalised.message);
  if (!normalised.hostname.startsWith("portal.")) throw new HttpError(400, "The domain must begin with portal.");
  const existing = await withTenant(ctx, (tx) => tx.customDomain.findUnique({ where: { hostname: normalised.hostname } }));
  return { available: !existing, normalisedDomain: normalised.hostname };
}

/** Real DNS check: format alone can never produce VERIFIED. */
export async function verifyPortalDomainDns(rawDomain: string) {
  const normalised = normaliseHostname(rawDomain);
  if (!normalised.ok || !normalised.hostname.startsWith("portal.")) {
    return { status: "FAILED" as const, checkedAt: new Date().toISOString(), message: normalised.ok ? "The domain must begin with portal." : normalised.message };
  }
  const expected = cnameTarget().toLowerCase().replace(/\.$/, "");
  try {
    const records = (await resolveCname(normalised.hostname)).map((r) => r.toLowerCase().replace(/\.$/, ""));
    const verified = records.includes(expected);
    return {
      status: verified ? ("VERIFIED" as const) : ("FAILED" as const),
      checkedAt: new Date().toISOString(),
      message: verified ? "DNS is pointing to the portal platform." : `The CNAME does not point to ${expected}.`,
    };
  } catch {
    return { status: "PENDING" as const, checkedAt: new Date().toISOString(), message: "No matching CNAME record is visible yet. DNS changes can take time to propagate." };
  }
}

export async function requestTemporaryBrandLogo(mime: string, sizeBytes: number) {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(mime)) throw new HttpError(400, "Use a PNG, JPG, JPEG, or WEBP image.");
  if (sizeBytes <= 0 || sizeBytes > 5 * 1024 * 1024) throw new HttpError(400, "Logo files must be 5 MB or smaller.");
  const storageKey = `brand-logo-temp/${randomUUID()}`;
  const uploadUrl = await createPresignedUploadUrl(storageKey, mime);
  return { uploadUrl, logoReference: storageKey };
}

/**
 * Uploads a temporary brand logo straight through our server to R2
 * (server-to-server — not subject to R2 bucket CORS, unlike the presigned-URL
 * flow above which requires the bucket to allow a direct browser PUT).
 */
export async function uploadTemporaryBrandLogo(mime: string, sizeBytes: number, file: Buffer) {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(mime)) throw new HttpError(400, "Use a PNG, JPG, JPEG, or WEBP image.");
  if (sizeBytes <= 0 || sizeBytes > 5 * 1024 * 1024) throw new HttpError(400, "Logo files must be 5 MB or smaller.");
  if (file.byteLength !== sizeBytes) throw new HttpError(422, "Uploaded file size does not match the declared size");

  const storageKey = `brand-logo-temp/${randomUUID()}`;
  await uploadObjectDirect(storageKey, mime, file);
  return { logoReference: storageKey };
}

function internalIdentifier(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "brand";
  return `${base}-${randomBytes(4).toString("hex")}`;
}

export async function provisionBrand(ctx: RequestContext, input: z.infer<typeof createBrandSchema>) {
  const domain = await checkPortalDomain(ctx, input.portalDomain);
  const prior = await withTenant(ctx, (tx) =>
    tx.tenant.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { customDomains: true } })
  );
  if (prior) return brandResponse(prior, prior.customDomains[0]?.hostname ?? domain.normalisedDomain, prior.customDomains[0]?.status ?? "PENDING");
  if (!domain.available) throw new HttpError(409, "This portal domain is already connected to another brand.");

  if (input.branding.logoReference && !(await storageObjectExists(input.branding.logoReference))) {
    throw new HttpError(400, "The uploaded logo could not be found. Upload it again.");
  }

  // Re-check DNS on final submission; browser-supplied verification state is never trusted.
  const dns = await verifyPortalDomainDns(domain.normalisedDomain);
  const domainStatus = dns.status === "VERIFIED" ? "VERIFIED" : "PENDING";
  const tenantStatus = input.status === "active" ? (domainStatus === "VERIFIED" ? "active" : "pending_domain") : "draft";
  const key = internalIdentifier(input.brandName);
  const verificationToken = `kick-verify-${randomBytes(16).toString("hex")}`;

  const tenant = await withTenant(ctx, async (tx) => {
    const created = await tx.tenant.create({
      data: {
        name: input.brandName,
        // This value exists only for backwards compatibility and internal
        // database uniqueness. Public tenant routing uses CustomDomain.hostname.
        slug: key,
        internalKey: key,
        idempotencyKey: input.idempotencyKey,
        status: tenantStatus,
        theme: {
          logoUrl: input.branding.logoReference ? `/api/brand-logo/brand-placeholder` : "",
          logoKey: input.branding.logoReference,
          primary: input.branding.primary,
          secondary: input.branding.secondary,
          font: input.branding.font,
        },
      },
    });
    if (input.branding.logoReference) {
      await tx.tenant.update({
        where: { id: created.id },
        data: { theme: { logoUrl: `/api/brand-logo/${created.id}`, logoKey: input.branding.logoReference, primary: input.branding.primary, secondary: input.branding.secondary, font: input.branding.font } },
      });
    }
    await tx.customDomain.create({ data: { tenantId: created.id, hostname: domain.normalisedDomain, status: domainStatus, verificationToken, verifiedAt: domainStatus === "VERIFIED" ? new Date() : null } });
    await writeAuditLog(tx, {
      tenantId: created.id,
      actorId: ctx.userId,
      role: "KICK_ADMIN",
      action: "tenant.create",
      entity: "Tenant",
      entityId: created.id,
      after: { name: created.name, status: tenantStatus, customDomain: domain.normalisedDomain, domainStatus, brandingConfigured: true, invitationRequested: input.admin.sendInvitation },
    });
    return created;
  });

  if (domainStatus === "VERIFIED" && isHostingConfigured()) await attachDomain(domain.normalisedDomain).catch(() => undefined);

  let invitationWarning: string | undefined;
  if (input.admin.sendInvitation && input.admin.email && input.admin.firstName && input.admin.lastName) {
    const email = input.admin.email.toLowerCase();
    const displayName = `${input.admin.firstName} ${input.admin.lastName}`.trim();
    try {
      const user = await authPrisma.user.findUnique({ where: { email } });
      if (user) {
        await withTenant(ctx, async (tx) => {
          const existing = await tx.membership.findUnique({ where: { clerkUserId_tenantId: { clerkUserId: user.id, tenantId: tenant.id } } });
          if (existing && existing.role !== "FRANCHISOR_ADMIN") throw new HttpError(409, "That account already has a conflicting membership.");
          if (!existing) await tx.membership.create({ data: { clerkUserId: user.id, tenantId: tenant.id, locationId: null, role: "FRANCHISOR_ADMIN", displayName, email } });
          await writeAuditLog(tx, { tenantId: tenant.id, actorId: ctx.userId, role: "KICK_ADMIN", action: "membership.create", entity: "Membership", after: { email, role: "FRANCHISOR_ADMIN" } });
        });
      } else {
        const invitation = await createInvitation(ctx, { email, displayName, role: "FRANCHISOR_ADMIN", tenantId: tenant.id, locationId: null, personalMessage: input.admin.personalMessage });
        if (invitation.deliveryFailed) invitationWarning = "The brand was created, but invitation delivery failed. Resend it from Brand Details.";
      }
    } catch {
      invitationWarning = "The brand was created, but the administrator invitation needs to be resent from Brand Details.";
    }
  }

  return { ...brandResponse(tenant, domain.normalisedDomain, domainStatus), invitationWarning, dnsInstructions: { type: "CNAME", host: "portal", value: cnameTarget(), ttl: "Automatic", ownershipRecord: verificationRecordName(domain.normalisedDomain) } };
}

function brandResponse(tenant: { id: string; name: string; status: string; createdAt: Date }, hostname: string, domainStatus: string) {
  return { success: true as const, brand: { id: tenant.id, name: tenant.name, status: tenant.status, portalDomain: hostname, portalUrl: `https://${hostname}`, domainStatus, createdAt: tenant.createdAt.toISOString() } };
}
