"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { setOwnNotificationPrefs } from "@/server/modules/notifications/prefs";
import { HttpError } from "@/server/modules/identity/errors";

export type ActionResult = { ok: boolean; message: string };

/** Saves the caller's own per-category notification opt-outs. */
export async function setNotificationPrefsAction(input: Record<string, boolean>): Promise<ActionResult> {
  try {
    const ctx = await requireRole("FRANCHISEE_USER")();
    await setOwnNotificationPrefs(ctx, input);
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, message: err.errors[0]?.message ?? "Invalid input." };
    if (err instanceof HttpError) return { ok: false, message: err.message };
    return { ok: false, message: "Could not save your preferences. Try again." };
  }
  revalidatePath("/settings");
  return { ok: true, message: "Preferences saved." };
}
