"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { requireRole } from "@/server/modules/identity/guard";
import {
  createUser,
  updateUser,
  setUserActive,
  resetUserPassword,
  deleteUser,
} from "@/server/modules/users/service";
import { personNameSchema, personEmailSchema, personPhoneSchema } from "@/server/modules/tenants/schemas";

export type ActionResult = { ok: boolean; message: string };

/**
 * User-management server actions.
 *
 * Every one begins with requireRole("KICK_ADMIN"), which throws before any
 * work happens — these mutate credentials and access, so a tenant-scoped role
 * must never reach them. Errors are returned as messages rather than thrown so
 * the client can render them inline; the service raises Error with copy that is
 * already safe to display.
 */

const ROLES: readonly Role[] = ["KICK_ADMIN", "FRANCHISOR_ADMIN", "FRANCHISEE_USER"];
function isRole(v: string): v is Role {
  return (ROLES as readonly string[]).includes(v);
}

function fail(err: unknown): ActionResult {
  return { ok: false, message: err instanceof Error ? err.message : "Something went wrong." };
}

export async function createUserAction(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  role: string;
  isActive: boolean;
  tenantId?: string;
  locationId?: string;
}): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  if (!input.name.trim()) return { ok: false, message: "Enter a full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return { ok: false, message: "Enter a valid email address." };
  if (input.password !== input.confirmPassword) return { ok: false, message: "Passwords do not match." };
  if (!isRole(input.role)) return { ok: false, message: "Select a valid role." };
  // Franchisee (store-level) accounts always need a specific store, and this
  // generic dialog has no store context — creating one here would either
  // silently leave locationId unset or accept an arbitrary client-supplied
  // id with no ownership check. They must be created from that store's own
  // page instead (see app/admin/stores/[id]/userActions.ts).
  if (input.role === "FRANCHISEE_USER") {
    return { ok: false, message: "Create franchisee users from their store's page, not here." };
  }

  try {
    await createUser(ctx, {
      name: input.name,
      email: input.email,
      phone: input.phone,
      password: input.password,
      role: input.role,
      isActive: input.isActive,
      tenantId: input.tenantId || null,
      locationId: input.locationId || null,
    });
  } catch (err) {
    return fail(err);
  }

  revalidatePath("/admin/users");
  return { ok: true, message: "User created." };
}

/** Full edit payload. Zod validates shape; the service re-checks the rules. */
const updateUserSchema = z.object({
  name: personNameSchema.optional(),
  email: personEmailSchema.optional(),
  phone: personPhoneSchema.optional(),
  role: z.enum(["KICK_ADMIN", "FRANCHISOR_ADMIN", "FRANCHISEE_USER"]).optional(),
  isActive: z.boolean().optional(),
  tenantId: z.string().optional(),
  locationId: z.string().optional(),
});

export async function updateUserAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const data = parsed.data;

  try {
    await updateUser(ctx, id, {
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      isActive: data.isActive,
      // Scope is meaningless for a platform admin; the service also forces
      // this, so a crafted payload cannot create a tenant-scoped KICK_ADMIN.
      tenantId: data.role === "KICK_ADMIN" ? null : (data.tenantId || null),
      locationId: data.role === "KICK_ADMIN" ? null : (data.locationId || null),
    });
  } catch (err) {
    return fail(err);
  }

  revalidatePath("/admin/users");
  return { ok: true, message: "User updated." };
}

export async function setUserActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  try {
    // Self-deactivation is blocked in the service, where the caller id is
    // authoritative — a client-side check alone would be trivially bypassed.
    await setUserActive(ctx, id, isActive);
  } catch (err) {
    return fail(err);
  }

  revalidatePath("/admin/users");
  return { ok: true, message: isActive ? "Account activated." : "Account deactivated." };
}

export async function resetPasswordAction(id: string, password: string, confirmPassword: string): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  if (password !== confirmPassword) return { ok: false, message: "Passwords do not match." };

  try {
    await resetUserPassword(ctx, id, password);
  } catch (err) {
    return fail(err);
  }

  revalidatePath("/admin/users");
  return { ok: true, message: "Password reset. The user must sign in again." };
}

export async function deleteUserAction(id: string): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  try {
    await deleteUser(ctx, id);
  } catch (err) {
    return fail(err);
  }

  revalidatePath("/admin/users");
  return { ok: true, message: "User deleted." };
}

// ─── Bulk actions ──────────────────────────────────────────────────────────────

export type BulkActionResult = { ok: boolean; message: string; partial?: boolean };

export async function bulkActivateUsersAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No users selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean; message: string }> = [];

  for (const id of ids) {
    try {
      await setUserActive(ctx, id, true);
      results.push({ ok: true, message: "Activated." });
    } catch (err) {
      results.push({ ok: false, message: err instanceof Error ? err.message : "Failed." });
    }
  }

  revalidatePath("/admin/users");
  const ok = results.filter((r) => r.ok).length;
  const fail2 = results.filter((r) => !r.ok).length;
  if (fail2 === 0) return { ok: true, message: `${ok} user${ok === 1 ? "" : "s"} activated.` };
  if (ok === 0) return { ok: false, message: `Could not activate ${fail2} user${fail2 === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} activated, ${fail2} failed.` };
}

export async function bulkDeactivateUsersAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No users selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean; message: string }> = [];

  for (const id of ids) {
    try {
      await setUserActive(ctx, id, false);
      results.push({ ok: true, message: "Deactivated." });
    } catch (err) {
      results.push({ ok: false, message: err instanceof Error ? err.message : "Failed." });
    }
  }

  revalidatePath("/admin/users");
  const ok = results.filter((r) => r.ok).length;
  const fail2 = results.filter((r) => !r.ok).length;
  if (fail2 === 0) return { ok: true, message: `${ok} user${ok === 1 ? "" : "s"} deactivated.` };
  if (ok === 0) return { ok: false, message: `Could not deactivate ${fail2} user${fail2 === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} deactivated, ${fail2} failed.` };
}

export async function bulkDeleteUsersAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No users selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean; message: string }> = [];

  for (const id of ids) {
    try {
      await deleteUser(ctx, id);
      results.push({ ok: true, message: "Deleted." });
    } catch (err) {
      results.push({ ok: false, message: err instanceof Error ? err.message : "Failed." });
    }
  }

  revalidatePath("/admin/users");
  const ok = results.filter((r) => r.ok).length;
  const fail2 = results.filter((r) => !r.ok).length;
  if (fail2 === 0) return { ok: true, message: `${ok} user${ok === 1 ? "" : "s"} deleted.` };
  if (ok === 0) return { ok: false, message: `Could not delete ${fail2} user${fail2 === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} deleted, ${fail2} failed.` };
}
