"use client";

import { useEffect } from "react";
import Link from "next/link";
/* eslint-disable @next/next/no-img-element -- brand logos use per-tenant URLs that cannot be allowlisted at build time. */
import { Globe, ArrowRight, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { parseTenantTheme } from "@/lib/theme";
import type { BrandRow } from "@/server/modules/tenants/brands";
import { BrandRowMenu } from "@/components/admin/BrandRowMenu";
import { useBulkSelection } from "./bulk/BulkSelection";
import { BulkCheckbox, BulkSelectAll } from "./bulk/BulkCheckbox";
import { cn } from "@/lib/utils";

/**
 * Brand list: table on desktop, cards on mobile.
 * `selectable` enables bulk checkbox column + syncs with BulkSelectionProvider.
 */
export function BrandsList({
  rows,
  selectable = false,
  totalFiltered,
}: {
  rows: BrandRow[];
  selectable?: boolean;
  totalFiltered?: number;
}) {
  const { setPage, isSelected } = useBulkSelection();

  useEffect(() => {
    if (!selectable) return;
    setPage(rows.map((b) => b.id), totalFiltered ?? rows.length);
  }, [rows, selectable, setPage, totalFiltered]);

  return (
    <>
      {/* Desktop table */}
      <div className="hidden scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-foreground/70">
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <BulkSelectAll allIds={rows.map((b) => b.id)} totalFiltered={totalFiltered ?? rows.length} />
                </th>
              )}
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Domain Status</th>
              <th className="px-4 py-3 text-right">Stores</th>
              <th className="px-4 py-3 text-right">Members</th>
              <th className="px-4 py-3 text-right">Orders</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const selected = selectable && isSelected(b.id);
              return (
                <tr
                  key={b.id}
                  className={cn(
                    "border-b border-border last:border-0 transition-colors",
                    selected ? "bg-status-info/5" : "hover:bg-muted/30"
                  )}
                >
                  {selectable && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <BulkCheckbox id={b.id} />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <BrandAvatar name={b.name} theme={b.theme} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-foreground">{b.name}</div>
                        {!b.customDomain && <div className="truncate text-xs text-muted-foreground">Domain pending</div>}
                        {b.customDomain && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Globe className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{b.customDomain}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><BrandStatus status={b.status} /></td>
                  <td className="px-4 py-3"><DomainStatusBadge status={b.domainStatus} /></td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">{b.storeCount}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">{b.memberCount}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">{b.orderCount}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{formatCents(b.revenueCents)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(b.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/brands/${b.id}`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground hover:bg-muted"
                      >
                        View Details
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                      <BrandRowMenu brand={b} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((b) => {
          const selected = selectable && isSelected(b.id);
          return (
            <div
              key={b.id}
              className={cn(
                "rounded-xl border bg-card p-4 shadow-sm transition-colors",
                selected ? "border-status-info/40 bg-status-info/5" : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {selectable && (
                    <BulkCheckbox id={b.id} />
                  )}
                  <BrandAvatar name={b.name} theme={b.theme} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-foreground">{b.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{b.customDomain ?? "Domain pending"}</div>
                  </div>
                </div>
                <BrandStatus status={b.status} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <DomainStatusBadge status={b.domainStatus} />
                {b.customDomain && (
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Globe className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {b.customDomain}
                  </span>
                )}
              </div>

              <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-center">
                <Metric label="Stores" value={String(b.storeCount)} />
                <Metric label="Members" value={String(b.memberCount)} />
                <Metric label="Orders" value={String(b.orderCount)} />
                <Metric label="Revenue" value={formatCents(b.revenueCents)} />
              </dl>

              <Link
                href={`/admin/brands/${b.id}`}
                className="mt-3 flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-status-info text-sm font-semibold text-white hover:opacity-95"
              >
                View Details
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/** Brand logo when the theme provides one, otherwise a coloured initial. */
function BrandAvatar({ name, theme }: { name: string; theme: unknown }) {
  const parsed = parseTenantTheme(theme ?? {});
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-bold text-white"
      style={{ backgroundColor: parsed.primary }}
    >
      {parsed.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- brand-supplied
        // remote URL; next/image would require per-brand domain allowlisting.
        <img src={parsed.logoUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

/**
 * Domain verification badge.
 *
 * "Verified" means ownership was proven — NOT that the domain is serving
 * traffic. The label deliberately avoids "Active" so the two are not
 * conflated; that conflation is what made an unreachable domain look healthy.
 */
function DomainStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">Not configured</span>;

  const map: Record<string, { cls: string; Icon: typeof CheckCircle2; label: string }> = {
    VERIFIED: { cls: "bg-status-success/15 text-status-success", Icon: CheckCircle2, label: "Verified" },
    PENDING: { cls: "bg-status-warning/15 text-status-warning", Icon: Clock, label: "Pending DNS" },
    FAILED: { cls: "bg-status-error/15 text-status-error", Icon: AlertTriangle, label: "Failed" },
  };
  const tone = map[status] ?? map.PENDING!;

  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", tone.cls)}>
      <tone.Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {tone.label}
    </span>
  );
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-CA", { day: "2-digit", month: "short", year: "numeric" });
}

function BrandStatus({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        active ? "bg-status-success/15 text-status-success" : "bg-muted text-foreground/70"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-status-success" : "bg-foreground/40")} />
      {active ? "Active" : status}
    </span>
  );
}
