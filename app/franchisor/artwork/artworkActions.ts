"use server";

import { revalidatePath } from "next/cache";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { setAssetStatus, promoteAssetVersion } from "@/server/modules/assets/service";
import { withTenant } from "@/server/db/withTenant";

export type BulkActionResult = { ok: boolean; message: string; partial?: boolean };

/**
 * Franchisor bulk actions are tenant-scoped: each id is verified to belong to
 * the caller's own brand before any status change, even though a franchisor
 * would only ever see their own assets' ids in the UI — an id typed/guessed
 * for another tenant must still fail closed here, not just at the UI layer.
 */
async function bulkSetStatus(ids: string[], status: "ACTIVE" | "ARCHIVED" | "DEPRECATED", verb: string): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No assets selected." };
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const results: Array<{ ok: boolean }> = [];

  for (const id of ids) {
    try {
      const owned = await withTenant(ctx, (tx) => tx.asset.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true } }));
      if (!owned) throw new Error("not found");
      await setAssetStatus(ctx, id, status);
      results.push({ ok: true });
    } catch {
      results.push({ ok: false });
    }
  }

  revalidatePath("/franchisor/artwork");
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  if (fail === 0) return { ok: true, message: `${ok} asset${ok === 1 ? "" : "s"} ${verb}.` };
  if (ok === 0) return { ok: false, message: `Could not ${verb.replace(/d$|ed$/, "")} ${fail} asset${fail === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} ${verb}, ${fail} failed.` };
}

export async function bulkArchiveAssetsAction(ids: string[]): Promise<BulkActionResult> {
  return bulkSetStatus(ids, "ARCHIVED", "archived");
}

export async function bulkDeprecateAssetsAction(ids: string[]): Promise<BulkActionResult> {
  return bulkSetStatus(ids, "DEPRECATED", "deprecated");
}

export async function bulkRestoreAssetsAction(ids: string[]): Promise<BulkActionResult> {
  return bulkSetStatus(ids, "ACTIVE", "restored");
}

/** Restore a specific prior version to current, from the version history table. Tenant-scoped via promoteAssetVersion's own history lookup. */
export async function restoreAssetVersionAction(assetId: string, targetVersionId: string): Promise<BulkActionResult> {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  try {
    await promoteAssetVersion(ctx, assetId, targetVersionId);
    revalidatePath(`/franchisor/artwork/${assetId}/versions`);
    revalidatePath("/franchisor/artwork");
    return { ok: true, message: "Version restored." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not restore this version." };
  }
}
