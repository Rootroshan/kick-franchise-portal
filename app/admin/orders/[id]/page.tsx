import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getOrderById } from "@/server/modules/commerce/admin";
import { refundOrder } from "@/server/modules/commerce/orderLifecycle";
import { HttpError } from "@/server/modules/identity/errors";
import { formatCents } from "@/lib/utils";
import { PageHeader, StatusBadge, EmptyState } from "@/components/admin/kit";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireRole("KICK_ADMIN")();

  let order;
  try {
    order = await getOrderById(ctx, params.id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  const remainingRefundable = order.subtotalCents - order.refundedCents;
  const canRefund = remainingRefundable > 0 && order.status !== "REFUNDED" && (order.status === "PAID" || order.status === "FULFILLED" || order.status === "PARTIALLY_REFUNDED");

  async function doRefund() {
    "use server";
    const c = await requireRole("KICK_ADMIN")();
    // Refund the full remaining amount; refundOrder clamps + reverses allowance.
    await refundOrder(params.id, remainingRefundable, c.userId);
    revalidatePath(`/admin/orders/${params.id}`);
  }

  return (
    <div>
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </Link>

      <PageHeader
        title={`Order ${order.id.slice(0, 8)}`}
        description={`${order.brandName} · ${order.storeName} · ${order.createdAt.toLocaleString()}`}
        secondaryAction={<StatusBadge status={order.status} />}
        action={
          canRefund ? (
            <ConfirmDialog
              trigger={
                <button className="inline-flex items-center gap-1.5 rounded-md border border-status-error/40 bg-card px-3 py-2 text-sm font-medium text-status-error hover:bg-status-error/5">
                  Refund {formatCents(remainingRefundable)}
                </button>
              }
              title="Refund order"
              description={`Refund the remaining ${formatCents(remainingRefundable)} for this order? Allowance-funded amounts are credited back to the store's ledger automatically. This cannot be undone.`}
              confirmLabel="Issue refund"
              destructive
              action={doRefund}
            />
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Money label="Subtotal" cents={order.subtotalCents} />
        <Money label="Allowance Applied" cents={order.allowanceAppliedCents} />
        <Money label="Card Charged" cents={order.cardChargedCents} />
        <Money label="Refunded" cents={order.refundedCents} tone={order.refundedCents > 0 ? "error" : undefined} />
      </div>

      <h2 className="mb-2 text-sm font-semibold">Line Items</h2>
      {order.lines.length === 0 ? (
        <EmptyState title="No line items" />
      ) : (
        <div className="scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Product</th>
                <th className="px-3 py-2.5 font-medium">Variant</th>
                <th className="px-3 py-2.5 font-medium">Qty</th>
                <th className="px-3 py-2.5 font-medium">Unit</th>
                <th className="px-3 py-2.5 font-medium">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 font-medium">{l.productName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{l.variantName}</td>
                  <td className="px-3 py-2.5 tabular-nums">{l.qty}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatCents(l.unitPriceCents)}</td>
                  <td className="px-3 py-2.5 font-medium tabular-nums">{formatCents(l.unitPriceCents * l.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Placed by {order.placedBy}</p>
    </div>
  );
}

function Money({ label, cents, tone }: { label: string; cents: number; tone?: "error" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${tone === "error" ? "text-status-error" : ""}`}>{formatCents(cents)}</div>
    </div>
  );
}
