"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { requireRole } from "@/server/modules/identity/guard";
import {
  createUser,
  updateUser,
  setUserActive,
  resetUserPassword,
  deleteUser,
} from "@/server/modules/users/service";

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

export async function updateUserAction(
  id: string,
  input: { name?: string; phone?: string; role?: string; tenantId?: string; locationId?: string }
): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  if (input.role !== undefined && !isRole(input.role)) return { ok: false, message: "Select a valid role." };

  try {
    await updateUser(ctx, id, {
      name: input.name,
      phone: input.phone,
      role: input.role as Role | undefined,
      tenantId: input.tenantId || null,
      locationId: input.locationId || null,
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
