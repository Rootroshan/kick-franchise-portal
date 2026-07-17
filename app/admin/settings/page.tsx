import Link from "next/link";
import { Settings as SettingsIcon, Database, ShieldCheck, Server, HardDrive, CreditCard, Bell, Mail, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getSystemHealth } from "@/server/modules/dashboard/health";
import { PageHeader } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

const SERVICE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Database,
  "RLS Security": ShieldCheck,
  "Redis / Worker": Server,
  "R2 Storage": HardDrive,
  Stripe: CreditCard,
  "Push (VAPID)": Bell,
  "Email (Resend)": Mail,
};

export default async function SettingsPage() {
  await requireRole("KICK_ADMIN")();
  const health = await getSystemHealth();

  return (
    <div>
      <PageHeader title="Settings" description="Platform configuration and service health. Per-brand theming and domains are managed on each brand's page." />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold">Service Health</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {health.services.map((s) => {
              const Icon = SERVICE_ICON[s.name] ?? SettingsIcon;
              return (
                <div key={s.name} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0">
                  <span className="flex items-center gap-2.5 text-sm font-medium">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {s.name}
                  </span>
                  <HealthPill status={s.status} />
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Platform</h2>
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <Row label="Version" value={health.version} />
            <Row label="Environment" value={health.environment} />
            <Row label="Role" value="Super Admin (KICK_ADMIN)" />
          </div>

          <h2 className="mb-2 mt-6 text-sm font-semibold">Manage</h2>
          <div className="flex flex-col gap-2">
            <Link href="/admin/brands" className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium hover:bg-muted">Brands &amp; domains →</Link>
            <Link href="/admin/audit-log" className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium hover:bg-muted">Audit logs →</Link>
            <Link href="/admin/notifications" className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium hover:bg-muted">Notification health →</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function HealthPill({ status }: { status: "ok" | "degraded" | "down" | "not_configured" }) {
  const map = {
    ok: { cls: "bg-status-success/10 text-status-success", Icon: CheckCircle2, label: "Operational" },
    degraded: { cls: "bg-status-warning/10 text-status-warning", Icon: AlertTriangle, label: "Degraded" },
    down: { cls: "bg-status-error/10 text-status-error", Icon: XCircle, label: "Down" },
    not_configured: { cls: "bg-muted text-muted-foreground", Icon: XCircle, label: "Not configured" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${map.cls}`}>
      <map.Icon className="h-3.5 w-3.5" />
      {map.label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
