"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { createUser, updateUser, setUserActive, resetUserPassword, deleteUser, listUsers } from "@/server/modules/users/service";
import { createInvitation, resendInvitation, listInvitations } from "@/server/auth/invitations";
import { personNameSchema, personEmailSchema, personPhoneSchema, passwordSchema } from "@/server/modules/tenants/schemas";

export type ActionResult = { ok: boolean; message: string };

/**
 * Franchisor Admin management, scoped to one brand.
 *
 * These wrap the shared user service rather than reimplementing it, so
 * password hashing, duplicate-email checks, session invalidation and audit
 * logging stay in one place.
 *
 * The scoping is the point: role is pinned to FRANCHISOR_ADMIN and tenantId to
 * the brand whose page you are on. Neither is taken from the client, so this
 * endpoint cannot be used to mint a KICK_ADMIN or attach a user to another
 * brand.
 */

const createSchema = z.object({
  name: personNameSchema,
  email: personEmailSchema,
  phone: personPhoneSchema.optional(),
  password: passwordSchema,
  isActive: z.boolean(),
});

function fail(err: unknown): ActionResult {
  return { ok: false, message: err instanceof Error ? err.message : "Something went wrong." };
}

export async function createFranchisorAdminAction(tenantId: string, slug: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await createUser(ctx, {
      ...parsed.data,
      // Pinned server-side. A client cannot request KICK_ADMIN here, nor point
      // the new account at a different brand.
      role: "FRANCHISOR_ADMIN",
      tenantId,
      locationId: null,
    });
  } catch (err) {
    return fail(err);
  }

  revalidatePath(`/admin/brands/${slug}`);
  return { ok: true, message: "Franchisor admin created." };
}

const inviteSchema = z.object({
  name: personNameSchema,
  email: personEmailSchema,
  phone: personPhoneSchema.optional(),
});

/** Sends an email invitation instead of setting a password directly — the account is created only on acceptance. */
export async function inviteFranchisorAdminAction(tenantId: string, slug: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await createInvitation(ctx, {
      displayName: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      role: "FRANCHISOR_ADMIN",
      tenantId,
    });
  } catch (err) {
    return fail(err);
  }

  revalidatePath(`/admin/brands/${slug}`);
  return { ok: true, message: "Invitation sent." };
}

export async function resendFranchisorAdminInvitationAction(invitationId: string, slug: string): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  try {
    await resendInvitation(ctx, invitationId);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/brands/${slug}`);
  return { ok: true, message: "Invitation resent." };
}

/** Pending/expired/failed invitations for this brand's franchisor admins — accepted ones drop off since they now have a real User row shown by listFranchisorAdmins. */
export async function listFranchisorAdminInvitations(tenantId: string) {
  await requireRole("KICK_ADMIN")();
  const all = await listInvitations(tenantId);
  return all.filter((i) => i.role === "FRANCHISOR_ADMIN" && i.status !== "ACCEPTED");
}

const updateSchema = z.object({
  name: personNameSchema.optional(),
  email: personEmailSchema.optional(),
  phone: personPhoneSchema.optional(),
});

export async function updateFranchisorAdminAction(userId: string, slug: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    // Role and tenant are deliberately NOT updatable here — changing either
    // belongs on the Users page, not inside one brand's admin list.
    await updateUser(ctx, userId, parsed.data);
  } catch (err) {
    return fail(err);
  }

  revalidatePath(`/admin/brands/${slug}`);
  return { ok: true, message: "Franchisor admin updated." };
}

export async function setFranchisorAdminActiveAction(userId: string, slug: string, isActive: boolean): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  try {
    await setUserActive(ctx, userId, isActive);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/brands/${slug}`);
  return { ok: true, message: isActive ? "Account activated." : "Account deactivated." };
}

export async function resetFranchisorAdminPasswordAction(
  userId: string,
  slug: string,
  password: string
): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  try {
    await resetUserPassword(ctx, userId, password);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/brands/${slug}`);
  return { ok: true, message: "Password reset. The user must sign in again." };
}

export async function deleteFranchisorAdminAction(userId: string, slug: string): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  try {
    await deleteUser(ctx, userId);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/brands/${slug}`);
  return { ok: true, message: "Franchisor admin deleted." };
}

/** Franchisor admins for one brand, with their account details. */
export async function listFranchisorAdmins(tenantId: string) {
  const ctx = await requireRole("KICK_ADMIN")();
  const { rows } = await listUsers(ctx, { role: "FRANCHISOR_ADMIN", brand: tenantId, page: 1, limit: 100 });
  return rows;
}
