import Link from "next/link";
import { Settings as SettingsIcon, Database, ShieldCheck, Server, HardDrive, CreditCard, Bell, Mail, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getSystemHealth, getStorageUsage } from "@/server/modules/dashboard/health";
import { PageHeader } from "@/components/admin/kit";
import { IntegrationSetup, type SetupField } from "@/components/admin/IntegrationSetup";
import { listSettingStatus } from "@/server/modules/settings/platformSettings";

const STRIPE_FIELDS: SetupField[] = [
  { key: "STRIPE_SECRET_KEY", label: "Secret key", hint: "sk_live_… or sk_test_…", secret: true },
  { key: "STRIPE_WEBHOOK_SECRET", label: "Webhook signing secret", hint: "whsec_…", secret: true },
  { key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", label: "Publishable key", hint: "pk_live_… or pk_test_…", secret: false },
];

const R2_FIELDS: SetupField[] = [
  { key: "R2_ACCOUNT_ID", label: "Account ID", hint: "Cloudflare account ID", secret: false },
  { key: "R2_ACCESS_KEY_ID", label: "Access key ID", secret: true },
  { key: "R2_SECRET_ACCESS_KEY", label: "Secret access key", secret: true },
  { key: "R2_BUCKET", label: "Bucket name", hint: "kick-assets", secret: false },
  { key: "R2_ENDPOINT", label: "Endpoint (optional)", hint: "Leave blank to derive from account ID", secret: false },
];

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
  const ctx = await requireRole("KICK_ADMIN")();
  // Independent reads — run concurrently so the storage rollup doesn't add
  // its latency on top of the health checks.
  const [health, storage, settingStatus] = await Promise.all([
    getSystemHealth(),
    getStorageUsage(),
    listSettingStatus(ctx),
  ]);

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
          <h2 className="mb-2 mt-6 text-sm font-semibold">Integration Setup</h2>
          <div className="flex flex-col gap-2">
            <IntegrationSetup
              service="stripe"
              title="Stripe"
              docsHref="https://dashboard.stripe.com/apikeys"
              docsLabel="Get your keys from the Stripe dashboard"
              fields={STRIPE_FIELDS}
              statuses={settingStatus}
            />
            <IntegrationSetup
              service="r2"
              title="Cloudflare R2"
              docsHref="https://dash.cloudflare.com/?to=/:account/r2/api-tokens"
              docsLabel="Create an R2 API token in Cloudflare"
              fields={R2_FIELDS}
              statuses={settingStatus}
            />
          </div>

          <h2 className="mb-2 mt-6 text-sm font-semibold">Recorded Storage Usage</h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold">{formatBytes(storage.totalBytes)}</span>
              <span className="text-sm text-muted-foreground">
                {storage.assetCount.toLocaleString()} {storage.assetCount === 1 ? "file" : "files"}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Summed from active asset records in this app — not Cloudflare billing usage. Files orphaned by a failed
              upload have no record here and are not counted.
            </p>

            {storage.byTenant.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No files uploaded yet.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2.5">
                {storage.byTenant.map((t) => (
                  <div key={t.tenantId}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{t.tenantName}</span>
                      <span className="text-muted-foreground">
                        {formatBytes(t.bytes)} · {t.assetCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-status-success"
                        style={{ width: `${storage.totalBytes ? (t.bytes / storage.totalBytes) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
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

/** Binary units (1024), matching what Cloudflare reports for R2. */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  // Whole numbers for bytes; one decimal above that ("1.4 MB" not "1.42 MB").
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
