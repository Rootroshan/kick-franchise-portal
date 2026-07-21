import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { listOrdersAdmin, getOrderKpis, getOrderById } from "@/server/modules/commerce/admin";
import type { AdminListQuery } from "@/lib/adminQuery";

const listQuery: AdminListQuery = { page: 1, limit: 20, search: "", status: "", brand: "", sort: "", direction: "asc", raw: {} };

/**
 * Orders are commerce data — the category FRANCHISOR_ADMIN must never reach.
 * These exercise the service directly with a franchisor context, so they
 * prove the DATABASE denies it (RLS) rather than merely that a route guard
 * is present.
 */
describe("Orders are locked out from franchisors", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("a franchisor sees zero orders even with orders present", async () => {
    const { tenant, location } = await seedTenantWithLocation();

    await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PAID",
          subtotalCents: 10_000,
          idempotencyKey: `test-key-${Date.now()}`,
          placedBy: "seed-user",
        },
      })
    );

    const asKick = await listOrdersAdmin(kickCtx(), listQuery);
    expect(asKick.total).toBe(1);

    const asFranchisor = await listOrdersAdmin(franchisorCtx(tenant.id), listQuery);
    expect(asFranchisor.total).toBe(0);
    expect(asFranchisor.rows).toHaveLength(0);
  });

  it("order KPIs read zero for a franchisor", async () => {
    const { tenant, location } = await seedTenantWithLocation();

    await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PAID",
          subtotalCents: 10_000,
          idempotencyKey: `test-key-${Date.now()}`,
          placedBy: "seed-user",
        },
      })
    );

    expect((await getOrderKpis(kickCtx())).total).toBe(1);
    expect((await getOrderKpis(franchisorCtx(tenant.id))).total).toBe(0);
  });

  it("a franchisor cannot fetch a single order by id — even their own tenant's", async () => {
    const { tenant, location } = await seedTenantWithLocation();

    const order = await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PAID",
          subtotalCents: 10_000,
          idempotencyKey: `test-key-${Date.now()}`,
          placedBy: "seed-user",
        },
      })
    );

    await expect(getOrderById(kickCtx(), order.id)).resolves.toBeTruthy();
    await expect(getOrderById(franchisorCtx(tenant.id), order.id)).rejects.toThrow();
  });
});
