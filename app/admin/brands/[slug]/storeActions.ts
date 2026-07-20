"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { HttpError } from "@/server/modules/identity/errors";

export type ActionResult = { ok: boolean; message: string };

/**
 * Store management from Brand Detail.
 *
 * tenantId comes from the brand page's own record, never the client, so a
 * store cannot be created under or moved to another brand. Every mutation
 * writes an audit entry inside the same transaction as the change.
 */

const storeSchema = z.object({
  name: z.string().trim().min(1, "Enter a store name.").max(200),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(50).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

function fail(err: unknown): ActionResult {
  return { ok: false, message: err instanceof Error ? err.message : "Something went wrong." };
}

export async function createStoreAction(tenantId: string, slug: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = storeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await withTenant(ctx, async (tx) => {
      const store = await tx.location.create({
        data: {
          tenantId,
          name: parsed.data.name,
          address: parsed.data.address || null,
          phone: parsed.data.phone || null,
          status: parsed.data.status ?? "active",
        },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: ctx.userId,
        role: ctx.role,
        action: "location.create",
        entity: "Location",
        entityId: store.id,
        after: { name: store.name, address: store.address, status: store.status },
      });
    });
  } catch (err) {
    return fail(err);
  }

  revalidatePath(`/admin/brands/${slug}`);
  return { ok: true, message: "Store created." };
}

export async function updateStoreAction(storeId: string, slug: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = storeSchema.partial().safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await withTenant(ctx, async (tx) => {
      const before = await tx.location.findUnique({ where: { id: storeId } });
      if (!before) throw new HttpError(404, "Store not found");

      const after = await tx.location.update({
        where: { id: storeId },
        data: {
          name: parsed.data.name,
          // "" clears the field; undefined leaves it untouched.
          address: parsed.data.address === undefined ? undefined : parsed.data.address || null,
          phone: parsed.data.phone === undefined ? undefined : parsed.data.phone || null,
          status: parsed.data.status,
        },
      });

      await writeAuditLog(tx, {
        tenantId: before.tenantId,
        actorId: ctx.userId,
        role: ctx.role,
        action: parsed.data.status && parsed.data.status !== before.status ? "location.status_change" : "location.update",
        entity: "Location",
        entityId: storeId,
        before: { name: before.name, address: before.address, phone: before.phone, status: before.status },
        after: { name: after.name, address: after.address, phone: after.phone, status: after.status },
      });
    });
  } catch (err) {
    return fail(err);
  }

  revalidatePath(`/admin/brands/${slug}`);
  return { ok: true, message: "Store updated." };
}

/**
 * Deletes a store.
 *
 * Location cascades to orders, allowances and onboarding progress, so a store
 * holding any of them is refused — that is operational and financial history,
 * and deactivating preserves it while achieving the same practical result.
 */
export async function deleteStoreAction(storeId: string, slug: string): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  try {
    await withTenant(ctx, async (tx) => {
      const store = await tx.location.findUnique({ where: { id: storeId } });
      if (!store) throw new HttpError(404, "Store not found");

      const [orders, members, allowances] = await Promise.all([
        tx.order.count({ where: { locationId: storeId } }),
        tx.membership.count({ where: { locationId: storeId } }),
        tx.allowance.count({ where: { locationId: storeId } }),
      ]);

      const blockers = [
        orders && `${orders} order${orders === 1 ? "" : "s"}`,
        members && `${members} member${members === 1 ? "" : "s"}`,
        allowances && `${allowances} allowance${allowances === 1 ? "" : "s"}`,
      ].filter(Boolean);

      if (blockers.length) {
        throw new HttpError(
          409,
          `This store still has ${blockers.join(", ")}. Deactivate it instead — deleting would destroy records that must be retained.`
        );
      }

      // Audit before the delete: afterwards the row it references is gone.
      await writeAuditLog(tx, {
        tenantId: store.tenantId,
        actorId: ctx.userId,
        role: ctx.role,
        action: "location.delete",
        entity: "Location",
        entityId: storeId,
        before: { name: store.name, address: store.address, status: store.status },
      });
      await tx.location.delete({ where: { id: storeId } });
    });
  } catch (err) {
    return fail(err);
  }

  revalidatePath(`/admin/brands/${slug}`);
  return { ok: true, message: "Store deleted." };
}
