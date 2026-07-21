import { randomBytes, createHash } from "node:crypto";
import type { Role, StoreRole } from "@prisma/client";
import { authPrisma } from "@/server/db/authClient";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { hashPassword, validatePasswordStrength } from "./password";
import { sendEmail } from "@/server/lib/email";
import { getEnv } from "@/lib/env";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — long enough for a franchisor/manager to get to it

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type InvitationInput = {
  email: string;
  displayName: string;
  phone?: string | null;
  role: Role;
  storeRole?: StoreRole | null;
  tenantId?: string | null;
  locationId?: string | null;
  personalMessage?: string | null;
};

/**
 * Issues an invitation and emails it. Does not create the User/Membership —
 * those are created only on acceptance, when the invitee sets their own
 * password (see acceptInvitation below).
 *
 * A prior pending invitation for the same email+role+tenant is superseded
 * (deleted) rather than left to coexist — resending should not produce two
 * live links to the same intended account.
 */
export async function createInvitation(ctx: RequestContext, input: InvitationInput): Promise<{ id: string; deliveryFailed: boolean }> {
  const email = input.email.trim().toLowerCase();

  const existingUser = await authPrisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error("An account with that email already exists.");

  await authPrisma.invitation.deleteMany({
    where: { email, tenantId: input.tenantId ?? null, status: "PENDING" },
  });

  const raw = randomBytes(32).toString("hex");
  const invitation = await authPrisma.invitation.create({
    data: {
      email,
      displayName: input.displayName.trim(),
      phone: input.phone?.trim() || null,
      role: input.role,
      storeRole: input.role === "FRANCHISEE_USER" ? (input.storeRole ?? "USER") : null,
      tenantId: input.tenantId ?? null,
      locationId: input.locationId ?? null,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      invitedBy: ctx.userId,
    },
  });

  await withTenant(ctx, (tx) =>
    writeAuditLog(tx, {
      tenantId: input.tenantId ?? null,
      actorId: ctx.userId,
      role: ctx.role,
      action: "invitation.create",
      entity: "Invitation",
      entityId: invitation.id,
      after: { email, role: input.role, tenantId: input.tenantId ?? null, locationId: input.locationId ?? null },
    })
  );

  await sendInvitationEmail(email, input.displayName, raw, input.role, input.personalMessage);

  const delivered = await authPrisma.invitation.findUnique({ where: { id: invitation.id }, select: { status: true } });
  return { id: invitation.id, deliveryFailed: delivered?.status === "FAILED" };
}

async function sendInvitationEmail(email: string, name: string, rawToken: string, role: Role, personalMessage?: string | null): Promise<void> {
  const base = getEnv().APP_BASE_DOMAIN;
  const link = `https://${base}/accept-invite?token=${rawToken}`;
  const roleLabel = role === "FRANCHISOR_ADMIN" ? "Franchisor Admin" : role === "FRANCHISEE_USER" ? "team member" : "administrator";

  try {
    await sendEmail({
      to: email,
      subject: "You've been invited to Kick Franchise Portal",
      html: `<p>Hi ${escapeHtml(name)},</p>
<p>You've been invited to join Kick Franchise Portal as a ${escapeHtml(roleLabel)}.</p>
${personalMessage ? `<p>${escapeHtml(personalMessage)}</p>` : ""}
<p><a href="${link}">Accept your invitation</a> to create your account and set a password.</p>
<p>This link expires in 7 days. If you weren't expecting this, you can ignore this email.</p>`,
    });
  } catch (err) {
    // Never let a delivery failure roll back the invitation record — the
    // resend action exists precisely so a failed send can be retried, and
    // the operator needs the row to still be there to click it.
    console.error(`[invitations] send failed for ${email}`, err);
    await authPrisma.invitation.updateMany({ where: { tokenHash: hashToken(rawToken) }, data: { status: "FAILED" } });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Resends an invitation: same token semantics reset, new expiry, new email. */
export async function resendInvitation(ctx: RequestContext, invitationId: string): Promise<void> {
  const invitation = await authPrisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation) throw new Error("Invitation not found.");
  if (invitation.status === "ACCEPTED") throw new Error("This invitation has already been accepted.");

  const raw = randomBytes(32).toString("hex");
  await authPrisma.invitation.update({
    where: { id: invitationId },
    data: { tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS), status: "PENDING" },
  });

  await withTenant(ctx, (tx) =>
    writeAuditLog(tx, {
      tenantId: invitation.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "invitation.resend",
      entity: "Invitation",
      entityId: invitationId,
      after: { email: invitation.email },
    })
  );

  await sendInvitationEmail(invitation.email, invitation.displayName, raw, invitation.role);
}

export type AcceptOutcome = { ok: true; userId: string } | { ok: false; message: string };

/**
 * Consumes an invitation and creates the User + Membership together. Single
 * use — the invitation row is marked ACCEPTED (not deleted, so "who invited
 * whom and when" survives for audit purposes, unlike a password-reset token
 * which has no such value once spent).
 */
export async function acceptInvitation(rawToken: string, password: string): Promise<AcceptOutcome> {
  const strengthError = validatePasswordStrength(password);
  if (strengthError) return { ok: false, message: strengthError };

  const invitation = await authPrisma.invitation.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!invitation) return { ok: false, message: "That invitation link is invalid." };
  if (invitation.status === "ACCEPTED") return { ok: false, message: "That invitation has already been used." };
  if (invitation.expiresAt < new Date()) {
    await authPrisma.invitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
    return { ok: false, message: "That invitation has expired. Ask for a new one." };
  }

  const existingUser = await authPrisma.user.findUnique({ where: { email: invitation.email } });
  if (existingUser) return { ok: false, message: "An account with that email already exists." };

  const user = await authPrisma.user.create({
    data: {
      name: invitation.displayName,
      email: invitation.email,
      phone: invitation.phone,
      passwordHash: await hashPassword(password),
      isActive: true,
    },
  });

  // Membership creation runs under withTenant() with a system-level context
  // (the invitee has no session yet — there is no caller identity to scope
  // by), mirroring how other pre-authentication writes in this codebase
  // authenticate as Kick-level rather than as the not-yet-existing user.
  const { systemKickContext } = await import("@/server/db/withTenant");
  await withTenant(systemKickContext(), async (tx) => {
    await tx.membership.create({
      data: {
        clerkUserId: user.id,
        tenantId: invitation.role === "KICK_ADMIN" ? null : invitation.tenantId,
        locationId: invitation.role === "FRANCHISEE_USER" ? invitation.locationId : null,
        role: invitation.role,
        storeRole: invitation.role === "FRANCHISEE_USER" ? invitation.storeRole : null,
        displayName: invitation.displayName,
        email: invitation.email,
      },
    });
    await writeAuditLog(tx, {
      tenantId: invitation.tenantId,
      actorId: user.id,
      role: invitation.role,
      action: "invitation.accept",
      entity: "User",
      entityId: user.id,
      after: { email: invitation.email, role: invitation.role },
    });
  });

  await authPrisma.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } });

  return { ok: true, userId: user.id };
}

export type InvitationRow = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  locationId: string | null;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "FAILED";
  createdAt: Date;
  expiresAt: Date;
};

/** Invitations for one brand (or platform-wide when tenantId is null), newest first. */
export async function listInvitations(tenantId: string | null): Promise<InvitationRow[]> {
  const rows = await authPrisma.invitation.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.displayName,
    role: r.role,
    locationId: r.locationId,
    status: r.status === "PENDING" && r.expiresAt < now ? "EXPIRED" : r.status,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  }));
}
