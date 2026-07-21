import Link from "next/link";
import { CreditCard, WalletCards, RotateCcw, AlertTriangle, Receipt, Webhook } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listPayments, getPaymentKpis, getWebhookHealth } from "@/server/modules/payments/service";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { formatCents, formatDateTime } from "@/lib/utils";
import { PageHeader, KPIStatCard, EmptyState, Pagination, StatusBadge } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // KICK_ADMIN only — payments are commerce data, which FRANCHISOR_ADMIN is
  // locked out of at the RLS layer as well.
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const status = typeof searchParams.status === "string" ? searchParams.status : "";

  const [{ rows, total }, kpis, webhook, brandOptions] = await Promise.all([
    listPayments(ctx, { search: q.search, status, brand: q.brand, page: q.page, limit: q.limit }),
    getPaymentKpis(ctx),
    getWebhookHealth(ctx),
    getBrandFilterOptions(ctx),
  ]);

  const pages = pageCount(total, q.limit);

  return (
    <div>
      <PageHeader title="Payments" description="Stripe payment activity across all brands and stores." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Card Volume" value={formatCents(kpis.cardVolumeCents)} icon={CreditCard} tone="info" />
        <KPIStatCard label="Allowance Applied" value={formatCents(kpis.allowanceVolumeCents)} icon={WalletCards} tone="success" />
        <KPIStatCard label="Refunded" value={formatCents(kpis.refundedCents)} icon={RotateCcw} tone="warning" />
        <KPIStatCard label="Failed Payments" value={kpis.failedCount} icon={AlertTriangle} tone="purple" />
      </div>

      <div className="mb-5 flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
        <Webhook className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground">
          {webhook.processed === 0 ? (
            "No Stripe webhooks received yet. Payment confirmation depends on them."
          ) : (
            <>
              <strong className="text-foreground">{webhook.processed}</strong> webhook
              {webhook.processed === 1 ? "" : "s"} processed
              {webhook.lastAt ? ` · last ${formatDateTime(webhook.lastAt)}` : ""}. Duplicate deliveries are ignored, so
              replays cannot double-charge.
            </>
          )}
        </span>
      </div>

      <ListToolbar
        searchPlaceholder="Search by order ID or Stripe reference…"
        filters={[
          { key: "brand", label: "Brand", options: brandOptions },
          {
            key: "status",
            label: "Status",
            options: [
              { value: "PENDING", label: "Pending" },
              { value: "PAID", label: "Paid" },
              { value: "FAILED", label: "Failed" },
              { value: "FULFILLED", label: "Fulfilled" },
              { value: "CANCELLED", label: "Cancelled" },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No payments found"
          description={q.search || status || q.brand ? "Try different filters." : "Payments appear here once orders are placed."}
          icon={Receipt}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Brand / Store</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Allowance / Card</th>
                  <th className="px-4 py-3 text-right font-medium">Refunded</th>
                  <th className="px-4 py-3 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.orderId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.tenantName}</div>
                      <div className="text-xs text-muted-foreground">{p.locationName}</div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCents(p.subtotalCents)}</td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                      {formatCents(p.allowanceAppliedCents)} / {formatCents(p.cardChargedCents)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                      {p.refundedCents > 0 ? formatCents(p.refundedCents) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${p.orderId}`} className="text-xs font-medium text-status-info hover:underline">
                        View order
                      </Link>
                      {/* The payment-intent id is a reference, not a secret —
                          it identifies the charge but grants no access. */}
                      {p.stripePaymentIntentId && (
                        <div className="truncate font-mono text-[11px] text-muted-foreground" title={p.stripePaymentIntentId}>
                          {p.stripePaymentIntentId}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((p) => (
              <div key={p.orderId} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.tenantName}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.locationName}</div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="font-semibold tabular-nums">{formatCents(p.subtotalCents)}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatCents(p.allowanceAppliedCents)} allowance / {formatCents(p.cardChargedCents)} card
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</span>
                  <Link href={`/admin/orders/${p.orderId}`} className="text-xs font-medium text-status-info hover:underline">
                    View order
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} payment{total === 1 ? "" : "s"}</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/payments", q.raw, { page: p })} />
      </div>
    </div>
  );
}
