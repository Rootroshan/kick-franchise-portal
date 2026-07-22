import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { checkout } from "@/server/modules/commerce/checkout";
import {
  listStoreOrders,
  getStoreOrderSummary,
  getStoreOrderDetail,
  prepareReorder,
  requestCancellation,
  getRecentOrderActivity,
} from "@/server/modules/commerce/storeOrders";
import { markOrderProcessing, markOrderShipped, markOrderDelivered, cancelOrder } from "@/server/modules/commerce/fulfilment";
import { orderRef, trackingUrl, DISPLAY_STATUS } from "@/lib/orderStatus";
import { kickCtx, franchiseeCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";

/**
 * Store User order-history experience: list/filter/search/summary, detail
 * isolation, fulfilment transitions + notifications, reorder validation, and
 * cancellation requests. Runs against the real RLS-enforced test database.
 */

async function seedCatalog(tenantId: string) {
  return withTenant(kickCtx(), async (tx) => {
    const product = await tx.product.create({
      data: { tenantId, name: "Volt Hoodie", sku: "HOOD-1", active: true },
    });
    const variant = await tx.productVariant.create({
      data: { productId: product.id, name: "Large", priceCents: 5000, stock: 100, active: true },
    });
    return { product, variant };
  });
}

async function grantAllowance(tenantId: string, locationId: string, grantedCents: number) {
  const year = new Date().getUTCFullYear();
  const quarter = Math.floor(new Date().getUTCMonth() / 3) + 1;
  return withTenant(kickCtx(), (tx) =>
    tx.allowance.create({
      data: { tenantId, locationId, periodLabel: `${year}-Q${quarter}`, grantedCents, createdBy: "test", overflow: "BLOCK" },
    })
  );
}

/** Allowance-only checkout (no Stripe leg) — the full production entry path. */
async function placeOrder(tenantId: string, locationId: string, variantId: string, qty = 1, userId = "store-user-1") {
  const ctx = franchiseeCtx(tenantId, locationId, userId);
  const result = await checkout(ctx, tenantId, {
    items: [{ variantId, qty }],
    idempotencyKey: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
  return result;
}

describe("Store order history", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("lists only the caller's own location's orders, with pagination and counts", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const other = await seedTenantWithLocation();
    const { variant } = await seedCatalog(tenant.id);
    const otherCatalog = await seedCatalog(other.tenant.id);
    await grantAllowance(tenant.id, location.id, 100_000);
    await grantAllowance(other.tenant.id, other.location.id, 100_000);

    await placeOrder(tenant.id, location.id, variant.id, 1);
    await placeOrder(tenant.id, location.id, variant.id, 2);
    await placeOrder(other.tenant.id, other.location.id, otherCatalog.variant.id, 1);

    const ctx = franchiseeCtx(tenant.id, location.id);
    const list = await listStoreOrders(ctx, { page: 1, pageSize: 1 });
    expect(list.total).toBe(2); // never the other store's order
    expect(list.rows).toHaveLength(1);
    expect(list.rows[0]!.itemCount).toBe(1);
    expect(list.rows[0]!.orderNumber).toBeGreaterThan(1000);

    const summary = await getStoreOrderSummary(ctx);
    expect(summary.total).toBe(2);
    expect(summary.processing).toBe(2); // allowance-only orders are PAID → Processing bucket
    expect(summary.shipped).toBe(0);
  });

  it("searches by order number and by product name/SKU; sorts by total", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedCatalog(tenant.id);
    await grantAllowance(tenant.id, location.id, 100_000);

    const a = await placeOrder(tenant.id, location.id, variant.id, 1); // 5000
    await placeOrder(tenant.id, location.id, variant.id, 3); // 15000

    const ctx = franchiseeCtx(tenant.id, location.id);

    const orderA = await getStoreOrderDetail(ctx, a.orderId);
    const byNumber = await listStoreOrders(ctx, { q: String(orderA!.orderNumber) });
    expect(byNumber.rows.map((r) => r.id)).toEqual([a.orderId]);

    // "VS-1025"-style refs parse down to the numeric part.
    const byRef = await listStoreOrders(ctx, { q: orderRef("Test Brand", orderA!.orderNumber) });
    expect(byRef.rows.map((r) => r.id)).toEqual([a.orderId]);

    expect((await listStoreOrders(ctx, { q: "hoodie" })).total).toBe(2);
    expect((await listStoreOrders(ctx, { q: "HOOD-1" })).total).toBe(2);
    expect((await listStoreOrders(ctx, { q: "no-such-thing" })).total).toBe(0);

    const bySubtotal = await listStoreOrders(ctx, { sort: "total_desc" });
    expect(bySubtotal.rows[0]!.subtotalCents).toBe(15_000);
    expect((await listStoreOrders(ctx, { sort: "total_asc" })).rows[0]!.subtotalCents).toBe(5_000);
  });

  it("order detail is scoped: another store's order id returns null, and money fields add up", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedCatalog(tenant.id);
    await grantAllowance(tenant.id, location.id, 3_000); // covers part; BLOCK would abort, so grant enough
    await grantAllowance(tenant.id, location.id, 0).catch(() => undefined); // no-op guard
    await withTenant(kickCtx(), (tx) =>
      tx.allowance.updateMany({ where: { locationId: location.id }, data: { grantedCents: 100_000 } })
    );
    const placed = await placeOrder(tenant.id, location.id, variant.id, 2);

    const ownCtx = franchiseeCtx(tenant.id, location.id);
    const detail = await getStoreOrderDetail(ownCtx, placed.orderId);
    expect(detail).not.toBeNull();
    expect(detail!.subtotalCents).toBe(10_000);
    expect(detail!.allowanceAppliedCents).toBe(10_000);
    expect(detail!.cardChargedCents).toBe(0);
    expect(detail!.paidAt).not.toBeNull(); // allowance-only → paid at checkout
    expect(detail!.lines).toHaveLength(1);
    expect(detail!.lines[0]!.sku).toBe("HOOD-1");

    // A different store in a different tenant cannot see it — even with the real id.
    const other = await seedTenantWithLocation();
    const foreignCtx = franchiseeCtx(other.tenant.id, other.location.id, "intruder");
    expect(await getStoreOrderDetail(foreignCtx, placed.orderId)).toBeNull();
  });

  it("runs the fulfilment lifecycle with timestamps + store notifications, and rejects invalid transitions", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedCatalog(tenant.id);
    await grantAllowance(tenant.id, location.id, 100_000);
    // A store member who should receive lifecycle notifications:
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: { clerkUserId: "store-user-1", tenantId: tenant.id, locationId: location.id, role: "FRANCHISEE_USER", storeRole: "USER" },
      })
    );
    const placed = await placeOrder(tenant.id, location.id, variant.id, 1);

    const admin = kickCtx();

    // Cannot deliver before shipping; cannot ship a cancelled order etc.
    await expect(markOrderDelivered(admin, placed.orderId)).rejects.toMatchObject({ status: 409 });

    const processing = await markOrderProcessing(admin, placed.orderId);
    expect(processing.status).toBe("PROCESSING");
    expect(processing.processingAt).not.toBeNull();

    // Unknown carrier and junk tracking numbers are rejected before any write.
    await expect(markOrderShipped(admin, placed.orderId, { carrier: "pigeon", trackingNumber: "ABC12345" })).rejects.toMatchObject({ status: 422 });
    await expect(markOrderShipped(admin, placed.orderId, { carrier: "ups", trackingNumber: "!!" })).rejects.toMatchObject({ status: 422 });

    const shipped = await markOrderShipped(admin, placed.orderId, { carrier: "ups", trackingNumber: "1Z999AA10123456784" });
    expect(shipped.status).toBe("SHIPPED");
    expect(shipped.shippedAt).not.toBeNull();
    expect(trackingUrl(shipped.carrier, shipped.trackingNumber)).toContain("ups.com");

    const delivered = await markOrderDelivered(admin, placed.orderId);
    expect(delivered.status).toBe("DELIVERED");
    expect(DISPLAY_STATUS[delivered.status]).toBe("delivered");

    // Re-delivering / re-processing a terminal order is refused.
    await expect(markOrderProcessing(admin, placed.orderId)).rejects.toMatchObject({ status: 409 });

    // The store member got one notification per event — deduplicated.
    const notifications = await withTenant(kickCtx(), (tx) =>
      tx.notification.findMany({ where: { clerkUserId: "store-user-1", category: "ORDER", entityId: placed.orderId } })
    );
    const events = notifications.map((n) => n.entity).sort();
    expect(events).toEqual(["Order:delivered", "Order:processing", "Order:shipped"].sort());

    // Activity feed shows the real events, newest first.
    const activity = await getRecentOrderActivity(franchiseeCtx(tenant.id, location.id));
    expect(activity[0]!.label).toBe("Order delivered");
  });

  it("admin cancel reverses the allowance debit and blocks card-charged orders", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedCatalog(tenant.id);
    const allowance = await grantAllowance(tenant.id, location.id, 100_000);
    const placed = await placeOrder(tenant.id, location.id, variant.id, 1);

    const cancelled = await cancelOrder(kickCtx(), placed.orderId);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();

    // Debit −5000 then compensating credit +5000 → balance restored, original row untouched.
    const ledger = await withTenant(kickCtx(), (tx) =>
      tx.allowanceLedger.findMany({ where: { allowanceId: allowance.id }, orderBy: { createdAt: "asc" } })
    );
    expect(ledger.map((l) => l.deltaCents)).toEqual([-5000, 5000]);

    // A card-charged order cannot be silently "cancelled".
    const cardOrder = await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PAID",
          subtotalCents: 2000,
          cardChargedCents: 2000,
          idempotencyKey: `card-${Date.now()}`,
          placedBy: "store-user-1",
        },
      })
    );
    await expect(cancelOrder(kickCtx(), cardOrder.id)).rejects.toMatchObject({ status: 409 });
  });

  it("reorder revalidates against the CURRENT catalog and prices", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { product, variant } = await seedCatalog(tenant.id);
    await grantAllowance(tenant.id, location.id, 100_000);
    const placed = await placeOrder(tenant.id, location.id, variant.id, 2);

    // Price rises after the order; a second variant goes inactive.
    await withTenant(kickCtx(), async (tx) => {
      await tx.productVariant.update({ where: { id: variant.id }, data: { priceCents: 6000 } });
      await tx.productVariant.create({ data: { productId: product.id, name: "Discontinued", priceCents: 100, active: false } });
    });

    const ctx = franchiseeCtx(tenant.id, location.id);
    const reorder = await prepareReorder(ctx, placed.orderId);
    expect(reorder.available).toHaveLength(1);
    expect(reorder.available[0]!.priceCents).toBe(6000); // today's price, not the 5000 snapshot
    expect(reorder.available[0]!.qty).toBe(2);
    expect(reorder.unavailable).toHaveLength(0);

    // Deactivate the product entirely → nothing is orderable, clearly reported.
    await withTenant(kickCtx(), (tx) => tx.product.update({ where: { id: product.id }, data: { active: false } }));
    const gone = await prepareReorder(ctx, placed.orderId);
    expect(gone.available).toHaveLength(0);
    expect(gone.unavailable[0]!.reason).toBe("No longer available");
  });

  it("cancellation requests: stamped once, only pre-fulfilment, and alerts KICK_ADMIN", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedCatalog(tenant.id);
    await grantAllowance(tenant.id, location.id, 100_000);
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({ data: { clerkUserId: "kick-admin-1", tenantId: null, role: "KICK_ADMIN" } })
    );
    const placed = await placeOrder(tenant.id, location.id, variant.id, 1);

    const ctx = franchiseeCtx(tenant.id, location.id, "store-user-1");
    await requestCancellation(ctx, placed.orderId, "Ordered the wrong size");

    const order = await getStoreOrderDetail(ctx, placed.orderId);
    expect(order!.cancellationRequestedAt).not.toBeNull();
    expect(order!.status).toBe("PAID"); // status untouched — request only

    // Second request and post-fulfilment requests are refused.
    await expect(requestCancellation(ctx, placed.orderId)).rejects.toMatchObject({ status: 409 });
    await markOrderProcessing(kickCtx(), placed.orderId);
    await markOrderShipped(kickCtx(), placed.orderId, { carrier: "fedex", trackingNumber: "TRACK123456" });
    await expect(requestCancellation(ctx, placed.orderId)).rejects.toMatchObject({ status: 409 });

    const adminAlert = await withTenant(kickCtx(), (tx) =>
      tx.notification.findMany({ where: { clerkUserId: "kick-admin-1", entity: "Order:cancel_request" } })
    );
    expect(adminAlert).toHaveLength(1);
    expect(adminAlert[0]!.href).toBe(`/admin/orders/${placed.orderId}`);
  });

  it("franchisor and cross-location contexts are locked out of store order queries", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedCatalog(tenant.id);
    await grantAllowance(tenant.id, location.id, 100_000);
    await placeOrder(tenant.id, location.id, variant.id, 1);

    // FRANCHISOR_ADMIN (no locationId) → 403 from the module guard.
    const franchisor = { tenantId: tenant.id, role: "FRANCHISOR_ADMIN" as const, locationId: null, storeRole: null, userId: "franchisor-1" };
    await expect(listStoreOrders(franchisor, {})).rejects.toMatchObject({ status: 403 });
    await expect(getStoreOrderSummary(franchisor)).rejects.toMatchObject({ status: 403 });

    // Same tenant, different store → sees nothing (explicit scope + RLS).
    const otherLocation = await withTenant(kickCtx(), (tx) => tx.location.create({ data: { tenantId: tenant.id, name: "Test Store #2" } }));
    const sibling = franchiseeCtx(tenant.id, otherLocation.id, "sibling-user");
    expect((await listStoreOrders(sibling, {})).total).toBe(0);
  });
});
