import { systemKickContext, withTenant } from "@/server/db/withTenant";
import { notifyTenantMembers } from "@/server/modules/notifications/inbox";
import { sendPushToLocationMembers } from "../../../../worker/push/send";
import { orderRef } from "@/lib/orderStatus";

export type OrderEvent = "placed" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded" | "payment_failed";

const EVENT_COPY: Record<OrderEvent, { title: (ref: string) => string; body: (ref: string) => string }> = {
  placed: { title: (r) => `Order ${r} placed`, body: () => "We've received your order and will confirm payment shortly." },
  paid: { title: (r) => `Payment confirmed for ${r}`, body: () => "Your payment went through. We'll start preparing your order." },
  processing: { title: (r) => `Order ${r} is being prepared`, body: () => "Your order is now being processed." },
  shipped: { title: (r) => `Order ${r} has shipped`, body: () => "Your order is on the way. Track it from the order page." },
  delivered: { title: (r) => `Order ${r} delivered`, body: () => "Your order has been delivered." },
  cancelled: { title: (r) => `Order ${r} cancelled`, body: () => "Your order has been cancelled. Any allowance used has been returned." },
  refunded: { title: (r) => `Order ${r} refunded`, body: () => "Your refund has been processed." },
  payment_failed: { title: (r) => `Payment failed for ${r}`, body: () => "The card payment for your order did not go through." },
};

/**
 * In-app + push notification to the store's members for one order lifecycle
 * event. In-app rows de-duplicate on (user, `Order:<event>`, orderId, ORDER)
 * via the Notification unique index, so webhook retries / double calls never
 * double-badge anyone. Push is best-effort (queued send with email fallback);
 * a push failure must never fail the state change that triggered it.
 */
export async function notifyOrderEvent(orderId: string, event: OrderEvent): Promise<void> {
  try {
    const order = await withTenant(systemKickContext(), (tx) =>
      tx.order.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true, tenantId: true, locationId: true, tenant: { select: { name: true } } } })
    );
    if (!order) return;

    const ref = orderRef(order.tenant.name, order.orderNumber);
    const copy = EVENT_COPY[event];
    const href = `/orders/${order.id}`;

    await notifyTenantMembers(systemKickContext(), {
      tenantId: order.tenantId,
      locationId: order.locationId,
      role: "FRANCHISEE_USER",
      category: "ORDER",
      title: copy.title(ref),
      body: copy.body(ref),
      href,
      entity: `Order:${event}`,
      entityId: order.id,
    });

    await sendPushToLocationMembers(order.tenantId, { title: copy.title(ref), body: copy.body(ref), url: href }, order.locationId, "ORDER");
  } catch (err) {
    // Notifications are downstream of the state change — log loudly, never rethrow.
    console.error(`Failed to send order ${event} notification for ${orderId}:`, err);
  }
}

/**
 * Alerts every KICK_ADMIN that a store requested cancellation. Kick admins
 * hold cross-tenant memberships (tenantId null), so this can't go through
 * notifyTenantMembers.
 */
export async function notifyKickAdminsCancellationRequest(orderId: string): Promise<void> {
  try {
    const order = await withTenant(systemKickContext(), (tx) =>
      tx.order.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true, tenant: { select: { name: true } }, location: { select: { name: true } } } })
    );
    if (!order) return;
    const ref = orderRef(order.tenant.name, order.orderNumber);

    const admins = await withTenant(systemKickContext(), (tx) =>
      tx.membership.findMany({ where: { role: "KICK_ADMIN", tenantId: null }, select: { clerkUserId: true } })
    );
    const { createNotification } = await import("@/server/modules/notifications/inbox");
    for (const admin of admins) {
      await createNotification(systemKickContext(), {
        clerkUserId: admin.clerkUserId,
        category: "ORDER",
        title: `Cancellation requested for ${ref}`,
        body: `${order.tenant.name} · ${order.location.name} asked to cancel this order.`,
        href: `/admin/orders/${order.id}`,
        entity: "Order:cancel_request",
        entityId: order.id,
      });
    }
  } catch (err) {
    console.error(`Failed to notify admins of cancellation request for ${orderId}:`, err);
  }
}
