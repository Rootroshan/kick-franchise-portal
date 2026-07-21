"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { HttpError } from "@/server/modules/identity/errors";
import { createLocationSchema, updateLocationSchema } from "@/server/modules/tenants/schemas";

export type ActionResult = { ok: boolean; message: string };

/**
 * Store management from Brand Detail.
 *
 * tenantId comes from the brand page's own record, never the client, so a
 * store cannot be created under or moved to another brand. Every mutation
 * writes an audit entry inside the same transaction as the change.
 *
 * Uses the shared schema from server/modules/tenants/schemas.ts rather than
 * a local one — a Location previously had two independently-defined and
 * drifting Zod shapes (this file and the old LocationsPanel API route).
 */
const storeSchema = createLocationSchema;

function fail(err: unknown): ActionResult {
  return { ok: false, message: err instanceof Error ? err.message : "Something went wrong." };
}

export async function createStoreAction(tenantId: string, slug: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = storeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await withTenant(ctx, async (tx) => {
      const existingCode = await tx.location.findUnique({
        where: { tenantId_storeCode: { tenantId, storeCode: parsed.data.storeCode } },
      });
      if (existingCode) throw new HttpError(409, "A store with this store number already exists for this brand.");

      const store = await tx.location.create({
        data: {
          tenantId,
          name: parsed.data.name,
          storeCode: parsed.data.storeCode,
          addressLine1: parsed.data.addressLine1,
          addressCity: parsed.data.addressCity,
          addressState: parsed.data.addressState,
          addressPostalCode: parsed.data.addressPostalCode,
          addressCountry: parsed.data.addressCountry,
          // Free-text address is derived from the structured fields so
          // existing display code (which reads this single string) keeps
          // working without every caller needing to know about the new
          // structured columns.
          address: [parsed.data.addressLine1, parsed.data.addressCity, parsed.data.addressState, parsed.data.addressPostalCode, parsed.data.addressCountry]
            .filter(Boolean)
            .join(", "),
          phone: parsed.data.phone,
          email: parsed.data.email,
          managerName: parsed.data.managerName,
          managerEmail: parsed.data.managerEmail,
          managerPhone: parsed.data.managerPhone,
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
        after: { name: store.name, storeCode: store.storeCode, address: store.address, status: store.status },
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

  const parsed = updateLocationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await withTenant(ctx, async (tx) => {
      const before = await tx.location.findUnique({ where: { id: storeId } });
      if (!before) throw new HttpError(404, "Store not found");

      if (parsed.data.storeCode && parsed.data.storeCode !== before.storeCode) {
        const existingCode = await tx.location.findUnique({
          where: { tenantId_storeCode: { tenantId: before.tenantId, storeCode: parsed.data.storeCode } },
        });
        if (existingCode) throw new HttpError(409, "A store with this store number already exists for this brand.");
      }

      const addressParts = [
        parsed.data.addressLine1 ?? before.addressLine1,
        parsed.data.addressCity ?? before.addressCity,
        parsed.data.addressState ?? before.addressState,
        parsed.data.addressPostalCode ?? before.addressPostalCode,
        parsed.data.addressCountry ?? before.addressCountry,
      ].filter(Boolean);

      const after = await tx.location.update({
        where: { id: storeId },
        data: {
          name: parsed.data.name,
          storeCode: parsed.data.storeCode,
          addressLine1: parsed.data.addressLine1,
          addressCity: parsed.data.addressCity,
          addressState: parsed.data.addressState,
          addressPostalCode: parsed.data.addressPostalCode,
          addressCountry: parsed.data.addressCountry,
          address: addressParts.length ? addressParts.join(", ") : undefined,
          phone: parsed.data.phone,
          email: parsed.data.email,
          managerName: parsed.data.managerName,
          managerEmail: parsed.data.managerEmail,
          managerPhone: parsed.data.managerPhone,
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
        before: { name: before.name, storeCode: before.storeCode, address: before.address, status: before.status },
        after: { name: after.name, storeCode: after.storeCode, address: after.address, status: after.status },
      });
    });
  } catch (err) {
    return fail(err);
  }

  revalidatePath(`/admin/brands/${slug}`);
  return { ok: true, message: "Store updated." };
}

/**
 * Deletes a store unconditionally.
 *
 * Location cascades to orders, allowances, task assignments and onboarding
 * progress at the DB level; memberships are detached (locationId set null,
 * the account itself survives) rather than deleted. The audit log records
 * what was attached at delete time, since those rows are gone afterward.
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

      // Audit before the delete: afterwards the rows it references are gone.
      await writeAuditLog(tx, {
        tenantId: store.tenantId,
        actorId: ctx.userId,
        role: ctx.role,
        action: "location.delete",
        entity: "Location",
        entityId: storeId,
        before: { name: store.name, address: store.address, status: store.status, orders, members, allowances },
      });
      await tx.location.delete({ where: { id: storeId } });
    });
  } catch (err) {
    return fail(err);
  }

  revalidatePath(`/admin/brands/${slug}`);
  return { ok: true, message: "Store deleted." };
}
