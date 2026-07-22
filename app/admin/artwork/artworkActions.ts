"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { setAssetStatus, promoteAssetVersion } from "@/server/modules/assets/service";

export type BulkActionResult = { ok: boolean; message: string; partial?: boolean };

async function bulkSetStatus(ids: string[], status: "ACTIVE" | "ARCHIVED" | "DEPRECATED", verb: string): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No assets selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean }> = [];

  for (const id of ids) {
    try {
      await setAssetStatus(ctx, id, status);
      results.push({ ok: true });
    } catch {
      results.push({ ok: false });
    }
  }

  revalidatePath("/admin/artwork");
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  if (fail === 0) return { ok: true, message: `${ok} asset${ok === 1 ? "" : "s"} ${verb}.` };
  if (ok === 0) return { ok: false, message: `Could not ${verb.replace(/d$|ed$/, "")} ${fail} asset${fail === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} ${verb}, ${fail} failed.` };
}

export async function bulkArchiveAssetsAction(ids: string[]): Promise<BulkActionResult> {
  return bulkSetStatus(ids, "ARCHIVED", "archived");
}

export async function bulkActivateAssetsAction(ids: string[]): Promise<BulkActionResult> {
  return bulkSetStatus(ids, "ACTIVE", "activated");
}

export async function bulkDeprecateAssetsAction(ids: string[]): Promise<BulkActionResult> {
  return bulkSetStatus(ids, "DEPRECATED", "deprecated");
}

export async function bulkRestoreAssetsAction(ids: string[]): Promise<BulkActionResult> {
  return bulkSetStatus(ids, "ACTIVE", "restored");
}

/** Restore a specific prior version to current, from the version history table. */
export async function restoreAssetVersionAction(assetId: string, targetVersionId: string): Promise<BulkActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  try {
    await promoteAssetVersion(ctx, assetId, targetVersionId);
    revalidatePath(`/admin/artwork/${assetId}/versions`);
    revalidatePath("/admin/artwork");
    return { ok: true, message: "Version restored." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not restore this version." };
  }
}
