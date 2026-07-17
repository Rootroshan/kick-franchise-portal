import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Store,
  CheckCircle2,
  ClipboardList,
  ListChecks,
  Download,
  Trophy,
  Megaphone,
  Activity as ActivityIcon,
  Bell,
  ShieldCheck,
  Plus,
  ChevronRight,
  AlertTriangle,
  Clock,
  CalendarClock,
  CircleCheck,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader, StatusBadge, EmptyState } from "@/components/admin/kit";
import { TrendIndicator } from "./TrendIndicator";
import { DateRangeFilter } from "./DateRangeFilter";
import type { FranchisorDashboardData, Kpi } from "@/server/modules/franchisor-dashboard/types";

const EngagementDonut = dynamic(() => import("./EngagementDonut").then((m) => m.EngagementDonut), {
  ssr: false,
  loading: () => <div className="h-48 w-full animate-pulse rounded-lg bg-muted" />,
});

const KPI_ICON: Record<Kpi["key"], LucideIcon> = {
  activeStores: Store,
  announcementsRead: CheckCircle2,
  tasksCompleted: ClipboardList,
  onboardingProgress: ListChecks,
  artworkDownloads: Download,
};

export function FranchisorDashboardView({ data, firstName }: { data: FranchisorDashboardData; firstName: string }) {
  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's what's happening across your brand."
        action={<DateRangeFilter />}
      />

      {/* KPI row */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>

      {/* Main grid + right rail */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <EngagementCard data={data} />
          <div className="grid gap-4 md:grid-cols-2">
            <AnnouncementsCard items={data.announcements} />
            <OnboardingCard items={data.onboarding} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <TaskSummaryCard tasks={data.tasks} />
          <BrandSummaryCard brand={data.brand} />
          <NotificationsCard items={data.notifications} />
        </div>
      </div>

      <ActivityCard items={data.activity} />

      <SecurePortalNotice />
    </div>
  );
}

/* ------------------------------- KPI card -------------------------------- */
function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = KPI_ICON[kpi.key];
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm" role="group" aria-label={`${kpi.label}: ${kpi.value}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
      </div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</div>
      {kpi.available ? (
        <>
          <div className="mt-0.5 text-2xl font-bold tabular-nums">{kpi.value}</div>
          <div className="mt-1">
            <TrendIndicator trend={kpi.trend} suffix={kpi.isPercent ? "%" : ""} label="vs last month" />
          </div>
        </>
      ) : (
        <div className="mt-0.5 text-sm text-muted-foreground">No data yet</div>
      )}
    </div>
  );
}

/* --------------------------- Engagement card ----------------------------- */
function EngagementCard({ data }: { data: FranchisorDashboardData }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Store Engagement Overview</h2>
        <Link href="/franchisor/analytics" className="text-sm font-medium text-primary hover:underline">View Analytics</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <EngagementDonut overall={data.engagement.overall} components={data.engagement.components} />
          <p className="sr-only">
            Overall engagement {data.engagement.overall} percent.
            {data.engagement.components.filter((c) => c.available).map((c) => ` ${c.label}: ${c.percent} percent.`).join("")}
          </p>
          <div className="mt-1 flex justify-center">
            <TrendIndicator trend={data.engagement.overallTrend} label="vs last month" />
          </div>
        </div>
        <ul className="flex flex-col justify-center gap-2.5">
          {data.engagement.components.map((c, i) => {
            const dot = ["bg-status-info", "bg-status-success", "bg-status-warning", "bg-status-purple"][i % 4];
            return (
              <li key={c.key} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />
                  {c.label}
                </span>
                <span className="font-semibold tabular-nums">{c.available ? `${c.percent}%` : "—"}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {data.topStores.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-status-warning" aria-hidden="true" /> Top Performing Stores
          </div>
          <ol className="flex flex-col gap-2">
            {data.topStores.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span className="w-4 text-center font-semibold text-muted-foreground">{i + 1}</span>
                <span className="flex-1 truncate">{s.name}</span>
                <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
                  <div className="h-full rounded-full bg-status-success" style={{ width: `${s.score}%` }} />
                </div>
                <span className="w-10 text-right font-semibold tabular-nums">{s.score}%</span>
              </li>
            ))}
          </ol>
          <Link href="/franchisor/stores" className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-border bg-card py-1.5 text-sm font-medium hover:bg-muted">
            View All Stores
          </Link>
        </div>
      )}
    </section>
  );
}

/* --------------------------- Task summary -------------------------------- */
function TaskSummaryCard({ tasks }: { tasks: FranchisorDashboardData["tasks"] }) {
  const rows: Array<{ icon: LucideIcon; label: string; value: number; tone: string }> = [
    { icon: ClipboardList, label: "Open Tasks", value: tasks.open, tone: "text-status-info" },
    { icon: AlertTriangle, label: "Overdue Tasks", value: tasks.overdue, tone: "text-status-error" },
    { icon: CalendarClock, label: "Due This Week", value: tasks.dueThisWeek, tone: "text-status-warning" },
    { icon: CircleCheck, label: "Completed Tasks", value: tasks.completed, tone: "text-status-success" },
  ];
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Tasks Summary</h2>
        <Link href="/franchisor/tasks" className="text-sm font-medium text-primary hover:underline">View All Tasks</Link>
      </div>
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between rounded-lg px-1 py-1.5">
            <span className="flex items-center gap-2 text-sm">
              <r.icon className={`h-4 w-4 ${r.tone}`} aria-hidden="true" />
              {r.label}
            </span>
            <span className="font-bold tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
      <Link href="/franchisor/tasks/new" className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
        <Plus className="h-4 w-4" /> Create New Task
      </Link>
    </section>
  );
}

/* --------------------------- Brand summary ------------------------------- */
function BrandSummaryCard({ brand }: { brand: FranchisorDashboardData["brand"] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold">Brand Summary</h2>
      <div className="mb-3 flex items-center gap-3">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt={`${brand.name} logo`} className="h-14 w-14 rounded-lg object-contain" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
            <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate font-semibold">{brand.name}</div>
          <div className="text-xs text-muted-foreground">Brand</div>
        </div>
      </div>
      <dl className="flex flex-col gap-1.5 text-sm">
        <Row label="Total Stores" value={brand.totalStores} />
        <Row label="Active Stores" value={brand.activeStores} />
        <Row label="Brand Admins" value={brand.brandAdmins} />
        <Row label="Brand Created" value={brand.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
      </dl>
      <Link href="/franchisor/settings" className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-border py-1.5 text-sm font-medium hover:bg-muted">
        View Brand Profile
      </Link>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/* ------------------------ Recent announcements --------------------------- */
function AnnouncementsCard({ items }: { items: FranchisorDashboardData["announcements"] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Recent Announcements</h2>
        <Link href="/franchisor/announcements" className="text-sm font-medium text-primary hover:underline">View All</Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No announcements yet" description="Publish your first brand announcement." icon={Megaphone} />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((a) => (
            <li key={a.id}>
              <Link href={`/franchisor/announcements/${a.id}`} className="flex items-start gap-2 rounded-lg p-1 hover:bg-muted">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Megaphone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{a.title}</span>
                    {a.isPinned && <StatusBadge status="pinned" />}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{a.excerpt}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {a.publishAt && <span>{a.publishAt.toLocaleDateString()}</span>}
                    {a.requiresAck && <span className="font-medium text-status-success">{a.readPercent}% read</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/franchisor/announcements/new" className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-sm font-medium hover:bg-muted">
        <Plus className="h-4 w-4" /> Create New Announcement
      </Link>
    </section>
  );
}

/* ------------------------- Onboarding progress --------------------------- */
function OnboardingCard({ items }: { items: FranchisorDashboardData["onboarding"] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Onboarding Progress</h2>
        <Link href="/franchisor/onboarding" className="text-sm font-medium text-primary hover:underline">View All</Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No onboarding templates" description="Create a template to track store setup." icon={ListChecks} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((t) => (
            <li key={t.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  {t.name}
                  {t.stalled && <StatusBadge status="overdue" />}
                </span>
                <span className="tabular-nums text-muted-foreground">{t.percent}%</span>
              </div>
              <div className="mb-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${t.percent === 100 ? "bg-status-success" : "bg-primary"}`} style={{ width: `${t.percent}%` }} />
              </div>
              <div className="text-[11px] text-muted-foreground">{t.storesCompleted} / {t.storesAssigned} stores</div>
            </li>
          ))}
        </ul>
      )}
      <Link href="/franchisor/onboarding/new" className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-sm font-medium hover:bg-muted">
        <Plus className="h-4 w-4" /> Create Onboarding Template
      </Link>
    </section>
  );
}

/* ---------------------------- Recent activity ---------------------------- */
function ActivityCard({ items }: { items: FranchisorDashboardData["activity"] }) {
  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Recent Activity</h2>
        <Link href="/franchisor/activity" className="text-sm font-medium text-primary hover:underline">View All</Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No recent activity" description="Actions across your brand will appear here." icon={ActivityIcon} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <ActivityIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  <span className="font-medium">{humanizeAction(a.action)}</span>
                  <span className="text-muted-foreground"> · {a.entity}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">{a.actor} · {a.createdAt.toLocaleString()}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function humanizeAction(action: string): string {
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ---------------------------- Notifications ------------------------------ */
function NotificationsCard({ items }: { items: FranchisorDashboardData["notifications"] }) {
  const ICON: Record<string, LucideIcon> = {
    overdue_tasks: AlertTriangle,
    unread_announcement: Megaphone,
    onboarding_inactivity: Clock,
    push_failure: Bell,
    system: CheckCircle2,
  };
  const TONE: Record<string, string> = {
    overdue_tasks: "text-status-error",
    unread_announcement: "text-status-info",
    onboarding_inactivity: "text-status-warning",
    push_failure: "text-status-error",
    system: "text-status-success",
  };
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Notifications</h2>
        <Link href="/franchisor/notifications" className="text-sm font-medium text-primary hover:underline">View All</Link>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((n) => {
          const Icon = ICON[n.category] ?? Bell;
          const body = (
            <div className="flex items-start gap-2 rounded-lg border border-border p-2.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TONE[n.category] ?? "text-muted-foreground"}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{n.message}</p>
                {n.href && <span className="mt-0.5 inline-flex items-center text-xs font-medium text-primary">View <ChevronRight className="h-3 w-3" /></span>}
              </div>
            </div>
          );
          return <li key={n.id}>{n.href ? <Link href={n.href} className="block hover:opacity-90">{body}</Link> : body}</li>;
        })}
      </ul>
    </section>
  );
}

/* -------------------------- Secure portal notice ------------------------- */
function SecurePortalNotice() {
  return (
    <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">Secure Portal:</span> This portal provides brand communication and engagement
        tools. Product, pricing, order, payment, allowance and rebate management are controlled exclusively by Kick Media and are not
        accessible from this portal.
      </p>
    </div>
  );
}
