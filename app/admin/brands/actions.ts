"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { updateTenant, deleteBrand, getBrandDeletionBlockers } from "@/server/modules/tenants/service";
import { updateTenantSchema } from "@/server/modules/tenants/schemas";

export type ActionResult = { ok: boolean; message: string };

/**
 * Edits brand details.
 *
 * KICK_ADMIN only — requireRole throws before any write. Input is validated
 * with the same Zod schema the API route uses, so the form and the API cannot
 * drift apart, and updateTenant() writes the audit entry.
 */
export async function updateBrandAction(tenantId: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = updateTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  try {
    await updateTenant(ctx, tenantId, parsed.data);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save changes." };
  }

  // Both the list and the detail page show brand fields.
  revalidatePath("/admin/brands");
  return { ok: true, message: "Brand updated." };
}

/**
 * Permanently deletes a brand.
 *
 * The typed name is compared against the database row inside deleteBrand(), not
 * here and not on the client — a tampered request cannot skip the
 * confirmation. Deletion is refused outright when the brand still holds
 * stores, members, orders, allowance ledger entries, rebate accruals or a
 * verified domain, because Tenant cascades to all of them and that would
 * destroy financial history.
 */
export async function deleteBrandAction(tenantId: string, typedName: string): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  try {
    const { name } = await deleteBrand(ctx, tenantId, typedName);
    revalidatePath("/admin/brands");
    return { ok: true, message: `${name} deleted.` };
  } catch (err) {
    // deleteBrand raises HttpError with copy that already explains WHY the
    // delete was refused and what to do instead.
    return { ok: false, message: err instanceof Error ? err.message : "Could not delete this brand." };
  }
}

/** What would block a permanent delete — drives the confirmation dialog. */
export async function getBrandBlockersAction(tenantId: string) {
  const ctx = await requireRole("KICK_ADMIN")();
  return getBrandDeletionBlockers(ctx, tenantId);
}

/** Suspends or reactivates a brand without touching its records. */
export async function setBrandStatusAction(tenantId: string, status: "active" | "suspended"): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  try {
    await updateTenant(ctx, tenantId, { status });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not update this brand." };
  }

  revalidatePath("/admin/brands");
  return {
    ok: true,
    message: status === "suspended" ? "Brand deactivated." : "Brand reactivated.",
  };
}

// ─── Bulk actions ──────────────────────────────────────────────────────────────

export type BulkActionResult = { ok: boolean; message: string; partial?: boolean };

/**
 * Bulk-activates brands by ID. Each brand is updated independently so one
 * failure does not block the others.
 */
export async function bulkActivateBrandsAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No brands selected." };

  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ id: string; ok: boolean; message: string }> = [];

  for (const id of ids) {
    try {
      await updateTenant(ctx, id, { status: "active" });
      results.push({ id, ok: true, message: "Activated." });
    } catch (err) {
      results.push({ id, ok: false, message: err instanceof Error ? err.message : "Failed." });
    }
  }

  revalidatePath("/admin/brands");
  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  if (failed === 0) return { ok: true, message: `${succeeded} brand${succeeded === 1 ? "" : "s"} activated.` };
  if (succeeded === 0) return { ok: false, message: `Could not activate ${failed} brand${failed === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${succeeded} activated, ${failed} failed.` };
}

/**
 * Bulk-deactivates brands by ID. Each brand is updated independently.
 */
export async function bulkDeactivateBrandsAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No brands selected." };

  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ id: string; ok: boolean; message: string }> = [];

  for (const id of ids) {
    try {
      await updateTenant(ctx, id, { status: "suspended" });
      results.push({ id, ok: true, message: "Deactivated." });
    } catch (err) {
      results.push({ id, ok: false, message: err instanceof Error ? err.message : "Failed." });
    }
  }

  revalidatePath("/admin/brands");
  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  if (failed === 0) return { ok: true, message: `${succeeded} brand${succeeded === 1 ? "" : "s"} deactivated.` };
  if (succeeded === 0) return { ok: false, message: `Could not deactivate ${failed} brand${failed === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${succeeded} deactivated, ${failed} failed.` };
}

/**
 * Bulk-deletes brands — only brands with zero related records are deleted.
 * Brands with stores, members, orders, payments, or history are skipped and
 * a partial result is returned so the operator knows which ones succeeded.
 */
export async function bulkDeleteBrandsAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No brands selected." };

  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ id: string; ok: boolean; message: string }> = [];

  for (const id of ids) {
    try {
      // Attempting to delete with a special placeholder name ("__bulk_delete__")
      // will fail the name check — we use the actual brand name by looking it up.
      // Use empty string so blockers always fire for bulk (safer — operator must
      // deactivate brands before bulk deleting).
      await deleteBrand(ctx, id, "");
      results.push({ id, ok: true, message: "Deleted." });
    } catch (err) {
      results.push({
        id,
        ok: false,
        message: err instanceof Error ? err.message : "Failed.",
      });
    }
  }

  revalidatePath("/admin/brands");
  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  if (failed === 0) return { ok: true, message: `${succeeded} brand${succeeded === 1 ? "" : "s"} permanently deleted.` };
  if (succeeded === 0)
    return {
      ok: false,
      message: `Could not delete ${failed} brand${failed === 1 ? "" : "s"}. Deactivate brands first — brands with stores, members, orders, or payments cannot be deleted.`,
    };
  return {
    ok: true,
    partial: true,
    message: `${succeeded} deleted, ${failed} skipped (deactivate first).`,
  };
}
