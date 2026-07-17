import Link from "next/link";
import { UserRound, Store, Building2, Settings as SettingsIcon, Wallet, Bell, ListChecks, Megaphone, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const ctx = await requireRole("FRANCHISEE_USER")();

  const data = await withTenant(ctx, async (tx) => {
    const [membership, tenant, location] = await Promise.all([
      tx.membership.findFirst({ where: { tenantId: ctx.tenantId ?? undefined, clerkUserId: ctx.userId }, select: { displayName: true, email: true, role: true } }),
      tx.tenant.findUnique({ where: { id: ctx.tenantId ?? undefined }, select: { name: true } }),
      tx.location.findUnique({ where: { id: ctx.locationId ?? undefined }, select: { name: true, address: true } }),
    ]);
    return { membership, tenant, location };
  });

  const name = data.membership?.displayName || data.membership?.email?.split("@")[0] || "Team Member";
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Profile</h1>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">{initials || "TM"}</span>
          <div className="min-w-0">
            <div className="truncate font-semibold">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{data.membership?.email ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Your access</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2.5 pt-0 text-sm">
          <Row icon={UserRound} label="Role" value="Store User" />
          <Row icon={Building2} label="Brand" value={data.tenant?.name ?? "—"} />
          <Row icon={Store} label="Store" value={data.location?.name ?? "—"} />
          {data.location?.address && <Row icon={Store} label="Address" value={data.location.address} />}
        </CardContent>
      </Card>

      <div className="flex flex-col overflow-hidden rounded-xl border border-border">
        <QuickLink href="/allowances" icon={Wallet} label="My allowance" />
        <QuickLink href="/notifications" icon={Bell} label="Notifications" />
        <QuickLink href="/announcements" icon={Megaphone} label="Announcements" />
        <QuickLink href="/onboarding" icon={ListChecks} label="Onboarding" />
        <QuickLink href="/settings" icon={SettingsIcon} label="Settings" />
      </div>

      <p className="text-xs text-muted-foreground">
        Your role, brand and store are managed by your franchise administrator and cannot be changed here.
      </p>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="flex min-h-12 items-center gap-3 border-b border-border bg-card px-4 last:border-0 hover:bg-muted">
      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" aria-hidden="true" /> {label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}
