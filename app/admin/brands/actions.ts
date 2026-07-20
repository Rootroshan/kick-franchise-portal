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
