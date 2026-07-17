import Link from "next/link";
import type { ReactNode } from "react";
import { Inbox, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================================
 * Shared admin UI kit — every management tab reuses these so we never
 * re-implement table chrome, KPI cards, empty/error states per page.
 * (Server-safe: no "use client" — these are pure presentational.)
 * ========================================================================== */

export function PageHeader({
  title,
  description,
  action,
  secondaryAction,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {secondaryAction}
        {action}
      </div>
    </div>
  );
}

export function KPIStatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "info",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "info" | "success" | "warning" | "error" | "purple" | "teal";
}) {
  const toneCls = {
    info: "text-status-info",
    success: "text-status-success",
    warning: "text-status-warning",
    error: "text-status-error",
    purple: "text-status-purple",
    teal: "text-status-teal",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        {Icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
            <Icon className={cn("h-4 w-4", toneCls)} />
          </div>
        )}
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

type BadgeTone = "success" | "warning" | "error" | "info" | "purple" | "teal" | "neutral";

const STATUS_MAP: Record<string, BadgeTone> = {
  // generic
  active: "success",
  published: "success",
  paid: "success",
  fulfilled: "success",
  completed: "success",
  verified: "success",
  ok: "success",
  inactive: "neutral",
  draft: "neutral",
  archived: "neutral",
  open: "info",
  scheduled: "info",
  processing: "warning",
  pending: "warning",
  "coming soon": "info",
  overdue: "error",
  failed: "error",
  cancelled: "error",
  expired: "error",
  deprecated: "warning",
  refunded: "purple",
  partially_refunded: "purple",
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/_/g, " ");
  const tone = STATUS_MAP[key] ?? STATUS_MAP[status.toLowerCase()] ?? "neutral";
  const cls: Record<BadgeTone, string> = {
    success: "bg-status-success/10 text-status-success ring-status-success/20",
    warning: "bg-status-warning/10 text-status-warning ring-status-warning/20",
    error: "bg-status-error/10 text-status-error ring-status-error/20",
    info: "bg-status-info/10 text-status-info ring-status-info/20",
    purple: "bg-status-purple/10 text-status-purple ring-status-purple/20",
    teal: "bg-status-teal/10 text-status-teal ring-status-teal/20",
    neutral: "bg-muted text-muted-foreground ring-border",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset", cls[tone])}>
      {key}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong loading this data." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-status-error/30 bg-status-error/5 px-6 py-12 text-center">
      <AlertCircle className="h-6 w-6 text-status-error" />
      <p className="text-sm text-status-error">{message}</p>
    </div>
  );
}

/** Server-rendered pagination (URL-driven). */
export function Pagination({ page, pageCount, makeHref }: { page: number; pageCount: number; makeHref: (p: number) => string }) {
  if (pageCount <= 1) return null;
  const prev = Math.max(1, page - 1);
  const next = Math.min(pageCount, page + 1);
  return (
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">Page {page} of {pageCount}</span>
      <div className="flex gap-1">
        <PageLink href={makeHref(prev)} disabled={page <= 1}>Previous</PageLink>
        <PageLink href={makeHref(next)} disabled={page >= pageCount}>Next</PageLink>
      </div>
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: ReactNode }) {
  if (disabled) {
    return <span className="cursor-not-allowed rounded-md border border-border px-3 py-1.5 text-muted-foreground opacity-50">{children}</span>;
  }
  return (
    <Link href={href} className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-muted">
      {children}
    </Link>
  );
}

/** Primary action button styled as a link (create/new flows). */
export function PrimaryButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
      {children}
    </Link>
  );
}

export function GhostButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
      {children}
    </Link>
  );
}
