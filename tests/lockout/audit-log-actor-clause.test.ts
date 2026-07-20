import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";

/**
 * Regression test for a real leak found in QA:
 *
 * AuditLog's SELECT policy has an "actor can read back their own row" clause
 * (needed because Prisma's .create() issues INSERT...RETURNING, which Postgres
 * subjects to the SELECT policy). That clause originally had NO commerce-entity
 * filter, so any non-Kick role sharing an actorId with a commerce audit write
 * could read commerce rows — bypassing the entity exclusion above it.
 *
 * Concretely: with DEV_BYPASS_AUTH every role shares userId "dev-bypass-user",
 * so a FRANCHISOR_ADMIN could read `ProductVariant` / `variant.priceOrStock.update`
 * rows written by KICK_ADMIN. Same shape of bug would apply to any real
 * impersonation/support flow that reuses an actor id.
 *
 * The fix repeats the commerce-entity exclusion inside the actor clause.
 */
const COMMERCE_ENTITIES = [
  "Product",
  "ProductVariant",
  "Order",
  "OrderLine",
  "Allowance",
  "AllowanceLedger",
  "RebateRule",
  "RebateAccrual",
  "LocationOrderingRule",
];

describe("AuditLog actor clause cannot leak commerce rows", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("hides commerce audit rows from a franchisor even when actorId matches", async () => {
    const { tenant } = await seedTenantWithLocation();
    const SHARED_ACTOR = "shared-actor-id";

    // KICK_ADMIN writes a commerce audit row under an actorId that the
    // franchisor session will also present.
    await withTenant(kickCtx(), (tx) =>
      tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorId: SHARED_ACTOR,
          role: "KICK_ADMIN",
          action: "variant.priceOrStock.update",
          entity: "ProductVariant",
          entityId: "some-variant-id",
        },
      })
    );

    // Franchisor with the SAME actorId must not see it.
    const visible = await withTenant(
      { ...franchisorCtx(tenant.id), userId: SHARED_ACTOR },
      (tx) => tx.auditLog.findMany()
    );

    const leaked = visible.filter((r) => COMMERCE_ENTITIES.includes(r.entity));
    expect(leaked).toHaveLength(0);
  });

  it("still lets a franchisor read back their OWN non-commerce audit row", async () => {
    const { tenant } = await seedTenantWithLocation();
    const ACTOR = "franchisor-actor";

    // INSERT...RETURNING is the reason the actor clause exists — it must work.
    const created = await withTenant({ ...franchisorCtx(tenant.id), userId: ACTOR }, (tx) =>
      tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorId: ACTOR,
          role: "FRANCHISOR_ADMIN",
          action: "announcement.publish",
          entity: "Announcement",
          entityId: "ann-1",
        },
      })
    );
    expect(created.id).toBeTruthy();
  });

  it("KICK_ADMIN can still read commerce audit rows", async () => {
    const { tenant } = await seedTenantWithLocation();
    await withTenant(kickCtx(), (tx) =>
      tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorId: "kick-actor",
          role: "KICK_ADMIN",
          action: "variant.priceOrStock.update",
          entity: "ProductVariant",
        },
      })
    );

    const rows = await withTenant(kickCtx(), (tx) => tx.auditLog.findMany({ where: { entity: "ProductVariant" } }));
    expect(rows.length).toBeGreaterThan(0);
  });
});
