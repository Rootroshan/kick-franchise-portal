import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getAllowanceDetail } from "@/server/modules/allowances/listView";
import { HttpError } from "@/server/modules/identity/errors";
import { formatCents } from "@/lib/utils";
import { PageHeader, StatusBadge, EmptyState } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  GRANT: "Grant",
  ORDER_DEBIT: "Order debit",
  REFUND_CREDIT: "Refund credit",
  ADJUSTMENT: "Adjustment",
};

export default async function AllowanceDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireRole("KICK_ADMIN")();

  let a;
  try {
    a = await getAllowanceDetail(ctx, params.id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <Link href="/admin/allowances" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Allowances
      </Link>

      <PageHeader
        title={`${a.storeName} · ${a.periodLabel}`}
        description={
          <Link href={`/admin/brands/${a.brandSlug}`} className="text-primary hover:underline">{a.brandName}</Link>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Money label="Granted" cents={a.grantedCents} />
        <Money label="Used" cents={a.usedCents} />
        <Money label="Balance" cents={a.balanceCents} tone={a.balanceCents <= 0 ? "error" : "success"} />
      </div>

      <h2 className="mb-2 text-sm font-semibold">Ledger (append-only)</h2>
      {a.ledger.length === 0 ? (
        <EmptyState title="No ledger entries" description="This allowance has no recorded movements yet." />
      ) : (
        <div className="scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Reason</th>
                <th className="px-3 py-2.5 font-medium">Order</th>
                <th className="px-3 py-2.5 font-medium">Change</th>
                <th className="px-3 py-2.5 font-medium">Balance After</th>
              </tr>
            </thead>
            <tbody>
              {a.ledger.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 text-muted-foreground">{l.createdAt.toLocaleString()}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={REASON_LABEL[l.reason] ?? l.reason} /></td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {l.orderId ? <Link href={`/admin/orders/${l.orderId}`} className="text-primary hover:underline">{l.orderId.slice(0, 8)}</Link> : "—"}
                  </td>
                  <td className={`px-3 py-2.5 font-medium tabular-nums ${l.deltaCents < 0 ? "text-status-error" : "text-status-success"}`}>
                    {l.deltaCents < 0 ? "" : "+"}
                    {formatCents(l.deltaCents)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{formatCents(l.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Money({ label, cents, tone }: { label: string; cents: number; tone?: "error" | "success" }) {
  const toneCls = tone === "error" ? "text-status-error" : tone === "success" ? "text-status-success" : "";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${toneCls}`}>{formatCents(cents)}</div>
    </div>
  );
}
