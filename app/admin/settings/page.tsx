import Link from "next/link";
import { Settings as SettingsIcon, Database, ShieldCheck, Server, HardDrive, CreditCard, Bell, Mail, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getSystemHealth, getStorageUsage } from "@/server/modules/dashboard/health";
import { PageHeader } from "@/components/admin/kit";
import { IntegrationSetup, type SetupStep } from "@/components/admin/IntegrationSetup";

const STRIPE_STEPS: SetupStep[] = [
  {
    title: "Open your Stripe API keys",
    body: "Sign in to Stripe and copy the Secret key. Use a test key until you are ready to take real payments.",
    link: { label: "Stripe API keys", href: "https://dashboard.stripe.com/apikeys" },
  },
  {
    title: "Create a webhook endpoint",
    body: "Point it at https://<your-domain>/api/webhooks/stripe and copy the signing secret it gives you.",
    link: { label: "Stripe webhooks", href: "https://dashboard.stripe.com/webhooks" },
  },
  {
    title: "Add both values to your hosting environment",
    body: "Set them in Vercel (Project → Settings → Environment Variables), then redeploy for the change to take effect.",
    link: { label: "Vercel environment variables", href: "https://vercel.com/dashboard" },
  },
];

const R2_STEPS: SetupStep[] = [
  {
    title: "Create an R2 bucket",
    body: "In Cloudflare, create a bucket for artwork and note its name and your account ID.",
    link: { label: "Cloudflare R2", href: "https://dash.cloudflare.com/?to=/:account/r2" },
  },
  {
    title: "Create an API token",
    body: "Create an R2 API token with Object Read & Write for that bucket, then copy the Access Key ID and Secret Access Key.",
    link: { label: "R2 API tokens", href: "https://dash.cloudflare.com/?to=/:account/r2/api-tokens" },
  },
  {
    title: "Add the values to your hosting environment",
    body: "Set them in Vercel (Project → Settings → Environment Variables), then redeploy for the change to take effect.",
    link: { label: "Vercel environment variables", href: "https://vercel.com/dashboard" },
  },
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
  await requireRole("KICK_ADMIN")();
  // Independent reads — run concurrently so the storage rollup doesn't add
  // its latency on top of the health checks.
  const [health, storage] = await Promise.all([getSystemHealth(), getStorageUsage()]);

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
              configured={health.services.find((s) => s.name === "Stripe")?.status === "ok"}
              envVars={["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]}
              steps={STRIPE_STEPS}
            />
            <IntegrationSetup
              service="r2"
              title="Cloudflare R2"
              configured={health.services.find((s) => s.name === "R2 Storage")?.status === "ok"}
              envVars={["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_ENDPOINT"]}
              steps={R2_STEPS}
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
