"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { createUser, updateUser, setUserActive, resetUserPassword, deleteUser } from "@/server/modules/users/service";
import { createInvitation, resendInvitation, listInvitations } from "@/server/auth/invitations";
import { personNameSchema, personEmailSchema, personPhoneSchema, passwordSchema } from "@/server/modules/tenants/schemas";
import { HttpError } from "@/server/modules/identity/errors";

export type ActionResult = { ok: boolean; message: string };

/**
 * Franchisee user management, scoped to one store.
 *
 * tenantId and locationId both come from the store's own record, never the
 * client — a franchisee user created here cannot be attached to another
 * store or brand. Role is pinned to FRANCHISEE_USER; storeRole (Manager vs
 * User) is the only access distinction this form can set.
 */

const createSchema = z.object({
  name: personNameSchema,
  email: personEmailSchema,
  phone: personPhoneSchema.optional(),
  password: passwordSchema,
  storeRole: z.enum(["MANAGER", "USER"]),
  isActive: z.boolean(),
});

function fail(err: unknown): ActionResult {
  return { ok: false, message: err instanceof Error ? err.message : "Something went wrong." };
}

async function assertStoreBelongsToTenant(ctx: Awaited<ReturnType<ReturnType<typeof requireRole>>>, locationId: string, tenantId: string) {
  const location = await withTenant(ctx, (tx) => tx.location.findUnique({ where: { id: locationId } }));
  if (!location || location.tenantId !== tenantId) throw new HttpError(422, "Store does not belong to this brand.");
}

export async function createStoreUserAction(
  tenantId: string,
  locationId: string,
  input: unknown
): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await assertStoreBelongsToTenant(ctx, locationId, tenantId);
    await createUser(ctx, {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      password: parsed.data.password,
      isActive: parsed.data.isActive,
      // Pinned server-side. A client cannot request KICK_ADMIN/FRANCHISOR_ADMIN
      // here, nor point the new account at a different store or brand.
      role: "FRANCHISEE_USER",
      tenantId,
      locationId,
      storeRole: parsed.data.storeRole,
    });
  } catch (err) {
    return fail(err);
  }

  revalidatePath(`/admin/stores/${locationId}`);
  return { ok: true, message: "Store user created." };
}

const inviteSchema = z.object({
  name: personNameSchema,
  email: personEmailSchema,
  phone: personPhoneSchema.optional(),
  storeRole: z.enum(["MANAGER", "USER"]),
});

/** Sends an email invitation instead of setting a password directly — the account is created only on acceptance. */
export async function inviteStoreUserAction(tenantId: string, locationId: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await assertStoreBelongsToTenant(ctx, locationId, tenantId);
    await createInvitation(ctx, {
      displayName: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      role: "FRANCHISEE_USER",
      storeRole: parsed.data.storeRole,
      tenantId,
      locationId,
    });
  } catch (err) {
    return fail(err);
  }

  revalidatePath(`/admin/stores/${locationId}`);
  return { ok: true, message: "Invitation sent." };
}

export async function resendStoreUserInvitationAction(invitationId: string, locationId: string): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  try {
    await resendInvitation(ctx, invitationId);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/stores/${locationId}`);
  return { ok: true, message: "Invitation resent." };
}

/** Pending/expired/failed invitations for this store — accepted ones drop off since they now have a real User row shown in the store's member list. */
export async function listStoreUserInvitations(tenantId: string, locationId: string) {
  await requireRole("KICK_ADMIN")();
  const all = await listInvitations(tenantId);
  return all.filter((i) => i.role === "FRANCHISEE_USER" && i.status !== "ACCEPTED" && i.locationId === locationId);
}

const updateSchema = z.object({
  name: personNameSchema.optional(),
  email: personEmailSchema.optional(),
  phone: personPhoneSchema.optional(),
  storeRole: z.enum(["MANAGER", "USER"]).optional(),
});

export async function updateStoreUserAction(userId: string, locationId: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    // Role/tenant/store are deliberately NOT editable here — a franchisee
    // user always stays FRANCHISEE_USER at their own store from this page.
    await updateUser(ctx, userId, parsed.data);
  } catch (err) {
    return fail(err);
  }

  revalidatePath(`/admin/stores/${locationId}`);
  return { ok: true, message: "Store user updated." };
}

export async function setStoreUserActiveAction(userId: string, locationId: string, isActive: boolean): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  try {
    await setUserActive(ctx, userId, isActive);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/stores/${locationId}`);
  return { ok: true, message: isActive ? "Account activated." : "Account deactivated." };
}

export async function resetStoreUserPasswordAction(userId: string, locationId: string, password: string): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  try {
    await resetUserPassword(ctx, userId, password);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/stores/${locationId}`);
  return { ok: true, message: "Password reset. The user must sign in again." };
}

export async function deleteStoreUserAction(userId: string, locationId: string): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  try {
    await deleteUser(ctx, userId);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/stores/${locationId}`);
  return { ok: true, message: "Store user deleted." };
}
