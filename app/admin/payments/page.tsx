import { CreditCard, WalletCards, RotateCcw, AlertTriangle, Receipt, Webhook } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listPayments, getPaymentKpis, getWebhookHealth } from "@/server/modules/payments/service";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { formatCents, formatDateTime } from "@/lib/utils";
import { PageHeader, KPIStatCard, EmptyState, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { PaymentsListSection } from "@/components/admin/payments/PaymentsListSection";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
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
        <PaymentsListSection rows={rows} total={total} />
      )}

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} payment{total === 1 ? "" : "s"}</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/payments", q.raw, { page: p })} />
      </div>
    </div>
  );
}
