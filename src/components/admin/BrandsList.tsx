import Link from "next/link";
import { Globe, ArrowRight, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { parseTenantTheme } from "@/lib/theme";
import type { BrandRow } from "@/server/modules/tenants/brands";
import { cn } from "@/lib/utils";

/**
 * Brand list: table on desktop, cards on mobile.
 *
 * Contrast is deliberate — brand name, counts and revenue use foreground text
 * rather than muted, because these are the values being scanned. Muted is
 * reserved for labels and secondary identifiers (slug, dates), which is what
 * makes the primary data stand out.
 */
export function BrandsList({ rows }: { rows: BrandRow[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-foreground/70">
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Stores</th>
              <th className="px-4 py-3 text-right">Members</th>
              <th className="px-4 py-3 text-right">Orders</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <BrandAvatar name={b.name} theme={b.theme} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{b.name}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground">{b.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><DomainCell domain={b.customDomain} status={b.domainStatus} /></td>
                <td className="px-4 py-3"><BrandStatus status={b.status} /></td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">{b.storeCount}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">{b.memberCount}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">{b.orderCount}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{formatCents(b.revenueCents)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/brands/${b.slug}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    View Details
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: an 8-column table cannot work on a phone. */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((b) => (
          <div key={b.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <BrandAvatar name={b.name} theme={b.theme} />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground">{b.name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">{b.slug}</div>
                </div>
              </div>
              <BrandStatus status={b.status} />
            </div>

            <div className="mt-3"><DomainCell domain={b.customDomain} status={b.domainStatus} /></div>

            <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-center">
              <Metric label="Stores" value={String(b.storeCount)} />
              <Metric label="Members" value={String(b.memberCount)} />
              <Metric label="Orders" value={String(b.orderCount)} />
              <Metric label="Revenue" value={formatCents(b.revenueCents)} />
            </dl>

            <Link
              href={`/admin/brands/${b.slug}`}
              className="mt-3 flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-status-info text-sm font-semibold text-white hover:opacity-95"
            >
              View Details
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ))}
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
 * Domain cell.
 *
 * VERIFIED means ownership was proven — not that the domain is serving. The
 * label says "Verified" rather than "Active" so the two are not conflated;
 * that conflation is what made a broken domain look healthy.
 */
function DomainCell({ domain, status }: { domain: string | null; status: string | null }) {
  if (!domain) {
    return <span className="text-xs text-muted-foreground">No custom domain</span>;
  }

  const map: Record<string, { cls: string; Icon: typeof CheckCircle2; label: string }> = {
    VERIFIED: { cls: "bg-status-success/15 text-status-success", Icon: CheckCircle2, label: "Verified" },
    PENDING: { cls: "bg-status-warning/15 text-status-warning", Icon: Clock, label: "Pending DNS" },
    FAILED: { cls: "bg-status-error/15 text-status-error", Icon: AlertTriangle, label: "Failed" },
  };
  const tone = map[status ?? ""] ?? map.PENDING!;

  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 font-mono text-xs text-foreground">
        <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {domain}
      </span>
      <span className={cn("inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", tone.cls)}>
        <tone.Icon className="h-3 w-3" aria-hidden="true" />
        {tone.label}
      </span>
    </div>
  );
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
