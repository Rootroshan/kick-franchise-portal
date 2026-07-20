"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { testStripe, testR2, type TestResult } from "@/server/modules/dashboard/connectionTest";
import { setSetting, clearSetting, isSettableKey } from "@/server/modules/settings/platformSettings";

/**
 * Runs a live connection test against an external integration.
 *
 * KICK_ADMIN-gated: these calls hit third-party APIs using platform credentials,
 * so they must not be reachable by tenant-scoped roles. The returned message is
 * pre-sanitised by connectionTest.ts and never contains credential material.
 */
export async function testConnectionAction(service: "stripe" | "r2"): Promise<TestResult> {
  await requireRole("KICK_ADMIN")();

  switch (service) {
    case "stripe":
      return testStripe();
    case "r2":
      return testR2();
    default:
      return { ok: false, message: "Unknown service." };
  }
}

export type SaveResult = { ok: boolean; message: string };

/**
 * Saves integration credentials, encrypted at rest.
 *
 * The key allowlist (isSettableKey) matters: without it, a crafted request could
 * write an arbitrary key name, and any future code doing getSetting(userInput)
 * would read attacker-controlled config. Values are never echoed back.
 */
export async function saveSettingsAction(entries: Record<string, string>): Promise<SaveResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const toSave = Object.entries(entries).filter(([, v]) => v.trim() !== "");
  if (toSave.length === 0) return { ok: false, message: "Nothing to save — enter at least one value." };

  const rejected = toSave.map(([k]) => k).filter((k) => !isSettableKey(k));
  if (rejected.length) return { ok: false, message: `Not a configurable setting: ${rejected.join(", ")}.` };

  try {
    for (const [key, value] of toSave) {
      if (!isSettableKey(key)) continue; // narrows the type; unreachable after the check above
      await setSetting(ctx, key, value);
    }
  } catch (err) {
    // Surface only our own validation messages — never a driver/provider error,
    // which can echo the submitted value.
    const message = err instanceof Error && err.message.startsWith("SETTINGS_ENCRYPTION_KEY")
      ? err.message
      : "Could not save. Check the server logs.";
    return { ok: false, message };
  }

  revalidatePath("/admin/settings");
  return { ok: true, message: `Saved ${toSave.length} ${toSave.length === 1 ? "value" : "values"}.` };
}

/** Removes a stored credential; the environment value (if any) becomes active again. */
export async function clearSettingAction(key: string): Promise<SaveResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  if (!isSettableKey(key)) return { ok: false, message: "Not a configurable setting." };

  try {
    await clearSetting(ctx, key);
  } catch {
    return { ok: false, message: "Could not remove the value. Check the server logs." };
  }

  revalidatePath("/admin/settings");
  return { ok: true, message: "Removed." };
}
