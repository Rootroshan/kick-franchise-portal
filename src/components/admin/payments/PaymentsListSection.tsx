"use client";

import { useEffect } from "react";
import { Download } from "lucide-react";
import { BulkSelectionProvider, useBulkSelection } from "@/components/admin/bulk/BulkSelection";
import { BulkActionToolbar, type BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { BulkCheckbox, BulkSelectAll } from "@/components/admin/bulk/BulkCheckbox";
import { formatCents, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/kit";
import type { PaymentRow } from "@/server/modules/payments/service";
import { bulkExportPaymentsAction } from "@/app/admin/payments/paymentActions";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Payments are financial records — export is the one bulk action offered
// here; there is deliberately no bulk delete/status-change for money rows.
// Defined outside the component so it isn't recreated every render.
const exportAction: BulkActionDef = {
  key: "export",
  label: "Export CSV",
  icon: <Download className="h-3.5 w-3.5" aria-hidden="true" />,
  tone: "default",
  action: async (ids) => {
    const result = await bulkExportPaymentsAction(ids);
    if (result.ok && result.csv) {
      const binary = atob(result.csv);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return result;
  },
};

type Props = {
  rows: PaymentRow[];
  total: number;
};

export function PaymentsListSection({ rows, total }: Props) {
  return (
    <BulkSelectionProvider>
      <PaymentsListSectionInner rows={rows} total={total} />
    </BulkSelectionProvider>
  );
}

function PaymentsListSectionInner({ rows, total }: Props) {
  const { setPage, isSelected, actionState } = useBulkSelection();

  useEffect(() => {
    setPage(rows.map((p) => p.orderId), total);
  }, [rows, setPage, total]);

  return (
    <>
      <BulkActionToolbar actions={[exportAction]} itemName="payment" />
      {/* Desktop table */}
      <div className="hidden scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="w-10 px-4 py-3 font-medium"><BulkSelectAll allIds={rows.map((p) => p.orderId)} totalFiltered={total} /></th>
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
            {rows.map((p) => {
              const selected = isSelected(p.orderId);
              return (
                <tr key={p.orderId} className={cn("border-b border-border last:border-0 transition-colors", selected ? "bg-status-info/5" : "hover:bg-muted/30")}>
                  <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <BulkCheckbox id={p.orderId} />
                  </td>
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
                    {p.stripePaymentIntentId && (
                      <div className="truncate font-mono text-[11px] text-muted-foreground" title={p.stripePaymentIntentId}>
                        {p.stripePaymentIntentId}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((p) => {
          const selected = isSelected(p.orderId);
          return (
            <div key={p.orderId} className={cn("rounded-xl border bg-card p-4 transition-colors", selected ? "border-status-info/40 bg-status-info/5" : "border-border")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BulkCheckbox id={p.orderId} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.tenantName}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.locationName}</div>
                  </div>
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
          );
        })}
      </div>
      {actionState.loading && <LoadingOverlay message="Processing request…" />}
    </>
  );
}
