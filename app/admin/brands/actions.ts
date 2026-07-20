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
