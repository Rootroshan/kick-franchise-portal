"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { updateOwnProfile, changeOwnPassword } from "@/server/modules/identity/profile";
import { HttpError } from "@/server/modules/identity/errors";

export type ActionResult = { ok: boolean; message: string };

function errorMessage(err: unknown): string {
  if (err instanceof z.ZodError) return err.errors[0]?.message ?? "Invalid input.";
  if (err instanceof HttpError) return err.message;
  return "Something went wrong. Try again.";
}

/** Edits the caller's own displayName/phone. Identity comes from the session, never the payload. */
export async function updateProfileAction(input: { displayName: string; phone?: string }): Promise<ActionResult> {
  try {
    const ctx = await requireRole("FRANCHISEE_USER")();
    await updateOwnProfile(ctx, input);
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
  revalidatePath("/profile");
  return { ok: true, message: "Profile updated." };
}

/** Logged-in password change — verifies the current password before writing a new hash. */
export async function changePasswordAction(input: { currentPassword: string; newPassword: string }): Promise<ActionResult> {
  try {
    const ctx = await requireRole("FRANCHISEE_USER")();
    const outcome = await changeOwnPassword(ctx, input);
    if (!outcome.ok) return { ok: false, message: outcome.message };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
  return { ok: true, message: "Password updated." };
}
