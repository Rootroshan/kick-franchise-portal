"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { AssetStatus } from "@prisma/client";
import { HttpError } from "@/server/modules/identity/errors";

export type BulkActionResult = { ok: boolean; message: string; partial?: boolean };

export async function bulkArchiveAssetsAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No assets selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean }> = [];

  for (const id of ids) {
    try {
      await withTenant(ctx, async (tx) => {
        const asset = await tx.asset.findUnique({ where: { id } });
        if (!asset) throw new HttpError(404, "Asset not found");
        await tx.asset.update({ where: { id }, data: { status: AssetStatus.ARCHIVED } });
      });
      results.push({ ok: true });
    } catch {
      results.push({ ok: false });
    }
  }

  revalidatePath("/admin/artwork");
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  if (fail === 0) return { ok: true, message: `${ok} asset${ok === 1 ? "" : "s"} archived.` };
  if (ok === 0) return { ok: false, message: `Could not archive ${fail} asset${fail === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} archived, ${fail} failed.` };
}

export async function bulkActivateAssetsAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No assets selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean }> = [];

  for (const id of ids) {
    try {
      await withTenant(ctx, async (tx) => {
        const asset = await tx.asset.findUnique({ where: { id } });
        if (!asset) throw new HttpError(404, "Asset not found");
        await tx.asset.update({ where: { id }, data: { status: AssetStatus.ACTIVE } });
      });
      results.push({ ok: true });
    } catch {
      results.push({ ok: false });
    }
  }

  revalidatePath("/admin/artwork");
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  if (fail === 0) return { ok: true, message: `${ok} asset${ok === 1 ? "" : "s"} activated.` };
  if (ok === 0) return { ok: false, message: `Could not activate ${fail} asset${fail === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} activated, ${fail} failed.` };
}
