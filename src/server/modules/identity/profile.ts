import { z } from "zod";
import { withTenant, systemKickContext, type RequestContext } from "@/server/db/withTenant";
import { authPrisma } from "@/server/db/authClient";
import { HttpError } from "./errors";
import { writeAuditLog } from "./audit";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/server/auth/password";

/**
 * Self-service profile for a Store User (FRANCHISEE_USER).
 *
 * A member may edit ONLY their own displayName (Membership) and phone (User).
 * Role, tenantId, locationId and storeRole are never accepted — the update
 * schema is .strict(), and the write's where-clause is built exclusively from
 * the server-derived RequestContext, never from input.
 *
 * The Membership write runs under systemKickContext(): RLS gives non-Kick
 * roles SELECT-only access to Membership (membership_self_read), so the
 * self-service update must use system authority — scoped hard to the caller's
 * own (clerkUserId, tenantId) row.
 */
const profileSchema = z
  .object({
    displayName: z.string().trim().min(1, "Name is required.").max(120, "Name is too long."),
    phone: z.string().trim().max(30, "Phone number is too long.").optional(),
  })
  .strict();

export type ProfileInput = z.infer<typeof profileSchema>;

export async function updateOwnProfile(ctx: RequestContext, input: unknown): Promise<void> {
  if (ctx.role !== "FRANCHISEE_USER" || !ctx.tenantId) {
    throw new HttpError(403, "Forbidden");
  }
  const parsed = profileSchema.parse(input);

  await withTenant(systemKickContext(), async (tx) => {
    const res = await tx.membership.updateMany({
      // Identity comes from the session context only — a crafted payload
      // cannot retarget another member or another tenant.
      where: { clerkUserId: ctx.userId, tenantId: ctx.tenantId, role: "FRANCHISEE_USER" },
      data: { displayName: parsed.displayName },
    });
    if (res.count === 0) throw new HttpError(404, "Membership not found");

    await writeAuditLog(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "membership.profile_update",
      entity: "Membership",
      after: { displayName: parsed.displayName, ...(parsed.phone !== undefined ? { phone: parsed.phone } : {}) },
    });
  });

  if (parsed.phone !== undefined) {
    // User rows are deny-all under RLS and always accessed via authPrisma
    // (same as the login/reset flows). updateMany: a dev-bypass/test context
    // may have no matching User row, which is fine — nothing to update.
    await authPrisma.user.updateMany({ where: { id: ctx.userId }, data: { phone: parsed.phone || null } });
  }
}

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(1, "Enter a new password."),
  })
  .strict();

export type PasswordChangeOutcome = { ok: true } | { ok: false; message: string };

/**
 * Logged-in password change. Verifies the current password against the stored
 * argon2id hash (same primitives as login/forgot-password) before writing a
 * new one. Failure messages never distinguish "no such account" from "wrong
 * password" beyond what the caller (who IS the account) already knows.
 */
export async function changeOwnPassword(ctx: RequestContext, input: unknown): Promise<PasswordChangeOutcome> {
  if (ctx.role !== "FRANCHISEE_USER") {
    throw new HttpError(403, "Forbidden");
  }
  const { currentPassword, newPassword } = passwordChangeSchema.parse(input);

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) return { ok: false, message: strengthError };

  const user = await authPrisma.user.findUnique({ where: { id: ctx.userId } });
  if (!user?.passwordHash || !user.isActive) {
    // OAuth-only or inactive account — no local hash to verify against.
    return { ok: false, message: "Password sign-in is not enabled for this account. Use the password reset link on the login page instead." };
  }

  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    return { ok: false, message: "Current password is incorrect." };
  }

  await authPrisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  // Audit the event only — never any password material.
  await withTenant(ctx, (tx) =>
    writeAuditLog(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "user.password_change",
      entity: "User",
      entityId: ctx.userId,
    })
  );

  return { ok: true };
}
