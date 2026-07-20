"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { createUser, updateUser, setUserActive, resetUserPassword, deleteUser, listUsers } from "@/server/modules/users/service";

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
  name: z.string().trim().min(1, "Enter a full name.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z.string().trim().max(50).optional(),
  password: z.string().min(8, "Password must be at least 8 characters."),
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

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().max(50).optional(),
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
