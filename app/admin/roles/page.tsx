import Link from "next/link";
import { ShieldCheck, Building2, Store, Lock, Check, X, Users2 } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getUserKpis } from "@/server/modules/users/service";
import { PageHeader, KPIStatCard } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Roles & Permissions.
 *
 * A reference view of what each role can reach, plus counts of who holds it.
 * Deliberately NOT an editor of the permission model itself: permissions are
 * enforced by PostgreSQL RLS policies and route guards, so a UI that appeared
 * to edit them would either be lying or would need to rewrite policies at
 * runtime — the latter being a privilege-escalation surface with no upside.
 *
 * Assigning a USER to a role is a different thing and is fully supported —
 * that lives on /admin/users via Manage Access.
 */

const LOCKED_FROM_FRANCHISOR = [
  "Product",
  "ProductVariant",
  "Order",
  "OrderLine",
  "Allowance",
  "AllowanceLedger",
  "RebateRule",
  "RebateAccrual",
  "LocationOrderingRule",
] as const;

type Capability = { label: string; kick: boolean; franchisor: boolean; franchisee: boolean };

const CAPABILITIES: Capability[] = [
  { label: "Manage brands & domains", kick: true, franchisor: false, franchisee: false },
  { label: "Manage platform users & roles", kick: true, franchisor: false, franchisee: false },
  { label: "Manage stores", kick: true, franchisor: true, franchisee: false },
  { label: "Publish announcements", kick: true, franchisor: true, franchisee: false },
  { label: "Manage artwork", kick: true, franchisor: false, franchisee: false },
  { label: "Assign tasks & onboarding", kick: true, franchisor: true, franchisee: false },
  { label: "Catalogue & pricing", kick: true, franchisor: false, franchisee: false },
  { label: "Ordering rules", kick: true, franchisor: false, franchisee: false },
  { label: "Place orders", kick: false, franchisor: false, franchisee: true },
  { label: "View orders & payments", kick: true, franchisor: false, franchisee: false },
  { label: "Allowances & rebates", kick: true, franchisor: false, franchisee: false },
  { label: "Platform settings & audit log", kick: true, franchisor: false, franchisee: false },
];

export default async function RolesPage() {
  const ctx = await requireRole("KICK_ADMIN")();
  const kpis = await getUserKpis(ctx);

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="What each role can access, and how those limits are enforced."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Total Users" value={kpis.total} icon={Users2} tone="info" />
        <KPIStatCard label="Super Admins" value={kpis.superAdmins} icon={ShieldCheck} tone="purple" />
        <KPIStatCard label="Active" value={kpis.active} icon={Check} tone="success" />
        <KPIStatCard label="Inactive" value={kpis.inactive} icon={X} tone="warning" />
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-3">
        <RoleCard
          icon={ShieldCheck}
          name="Super Admin"
          code="KICK_ADMIN"
          scope="Platform-wide — every brand and store"
          summary="Full control across brands, commerce, users and platform operations."
          tone="purple"
        />
        <RoleCard
          icon={Building2}
          name="Franchisor Admin"
          code="FRANCHISOR_ADMIN"
          scope="One brand — all of its stores"
          summary="Runs a brand's stores, announcements, tasks and onboarding. No commerce access."
          tone="info"
        />
        <RoleCard
          icon={Store}
          name="Franchisee User"
          code="FRANCHISEE_USER"
          scope="One store"
          summary="Orders supplies, completes tasks and onboarding for a single location."
          tone="warning"
        />
      </div>

      <h2 className="mb-2 text-sm font-semibold">Capabilities</h2>
      <div className="mb-6 scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Capability</th>
              <th className="px-4 py-3 text-center font-medium">Super Admin</th>
              <th className="px-4 py-3 text-center font-medium">Franchisor</th>
              <th className="px-4 py-3 text-center font-medium">Franchisee</th>
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((c) => (
              <tr key={c.label} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5">{c.label}</td>
                <td className="px-4 py-2.5 text-center"><Allowed value={c.kick} /></td>
                <td className="px-4 py-2.5 text-center"><Allowed value={c.franchisor} /></td>
                <td className="px-4 py-2.5 text-center"><Allowed value={c.franchisee} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-semibold">Franchisor commerce lockout</h2>
      <div className="rounded-xl border border-status-error/30 bg-status-error/5 p-4">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-status-error" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-status-error">
              FRANCHISOR_ADMIN is denied all commerce data at four independent layers.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              UI navigation, route guards returning 403, an ESLint import boundary that fails the build if franchisor
              code imports a commerce module, and PostgreSQL row-level security that returns zero rows even if the
              layers above were bypassed.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {LOCKED_FROM_FRANCHISOR.map((e) => (
                <span key={e} className="rounded-md bg-status-error/10 px-2 py-0.5 font-mono text-[11px] text-status-error">
                  {e}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-5 text-sm text-muted-foreground">
        Permissions themselves are defined by database policies and route guards, so they are not editable here — that
        is what keeps them enforceable rather than advisory. To change what a person can reach, assign them a different
        role on{" "}
        <Link href="/admin/users" className="font-medium text-status-info hover:underline">
          Users
        </Link>
        .
      </p>
    </div>
  );
}

function RoleCard({
  icon: Icon,
  name,
  code,
  scope,
  summary,
  tone,
}: {
  icon: typeof ShieldCheck;
  name: string;
  code: string;
  scope: string;
  summary: string;
  tone: "purple" | "info" | "warning";
}) {
  const toneCls = {
    purple: "bg-purple-100 text-purple-700",
    info: "bg-blue-100 text-blue-700",
    warning: "bg-amber-100 text-amber-700",
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneCls)}>
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div>
          <div className="text-sm font-semibold">{name}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{code}</div>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{summary}</p>
      <p className="mt-2 text-xs font-medium">{scope}</p>
    </div>
  );
}

function Allowed({ value }: { value: boolean }) {
  return value ? (
    <Check className="mx-auto h-4 w-4 text-status-success" aria-label="Allowed" />
  ) : (
    <X className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="Not allowed" />
  );
}
