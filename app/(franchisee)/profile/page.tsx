import Link from "next/link";
import {
  Bell,
  Building2,
  ChevronRight,
  Hash,
  ListChecks,
  MapPin,
  Megaphone,
  Package,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { authPrisma } from "@/server/db/authClient";
import { getOwnAllowanceBalance } from "@/server/modules/allowances/admin";
import { formatCents } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditProfileDialog } from "@/components/franchisee/EditProfileDialog";
import { ChangePasswordDialog } from "@/components/franchisee/ChangePasswordDialog";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const ctx = await requireRole("FRANCHISEE_USER")();

  const [data, user, balances] = await Promise.all([
    withTenant(ctx, async (tx) => {
      const [membership, tenant, location] = await Promise.all([
        tx.membership.findFirst({
          where: { tenantId: ctx.tenantId ?? undefined, clerkUserId: ctx.userId },
          select: { displayName: true, email: true },
        }),
        tx.tenant.findUnique({ where: { id: ctx.tenantId ?? undefined }, select: { name: true } }),
        ctx.locationId
          ? tx.location.findUnique({
              where: { id: ctx.locationId },
              select: { name: true, storeCode: true, address: true, addressCity: true, addressState: true, addressCountry: true },
            })
          : Promise.resolve(null),
      ]);
      return { membership, tenant, location };
    }),
    // Phone lives on the auth User row (deny-all RLS table, always via authPrisma).
    authPrisma.user.findUnique({ where: { id: ctx.userId }, select: { phone: true } }),
    getOwnAllowanceBalance(ctx).catch(() => []),
  ]);

  const name = data.membership?.displayName || data.membership?.email?.split("@")[0] || "Team Member";
  const initials =
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "TM";

  const composedAddress = [data.location?.addressCity, data.location?.addressState, data.location?.addressCountry]
    .filter(Boolean)
    .join(", ");
  const address = composedAddress || data.location?.address || "—";

  const totalBalanceCents = balances.reduce((sum, b) => sum + b.balanceCents, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">My Account</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, preferences and account settings.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* ---------- Main column ---------- */}
        <div className="flex flex-col gap-4 md:col-span-2">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold">{name}</span>
                  <Badge variant="secondary">Store User</Badge>
                </div>
                <div className="truncate text-sm text-muted-foreground">{data.membership?.email ?? "—"}</div>
                {user?.phone && <div className="truncate text-xs text-muted-foreground">{user.phone}</div>}
              </div>
              <EditProfileDialog displayName={data.membership?.displayName ?? ""} phone={user?.phone ?? null} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Your access</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 pt-0 sm:grid-cols-2">
              <AccessTile icon={UserRound} label="Role" value="Store User" />
              <AccessTile icon={Building2} label="Brand" value={data.tenant?.name ?? "—"} />
              <AccessTile icon={Store} label="Store" value={data.location?.name ?? "—"} />
              <AccessTile icon={Hash} label="Location code" value={data.location?.storeCode ?? "—"} />
              <AccessTile icon={MapPin} label="Address" value={address} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Account settings</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col pt-0">
              <SettingsRow href="/allowances" icon={Wallet} title="My allowance" description="View allowance history and transaction details" />
              <SettingsRow href="/notifications" icon={Bell} title="Notifications" description="Manage your notification preferences" />
              <SettingsRow href="/announcements" icon={Megaphone} title="Announcements" description="View all announcements and company updates" />
              <SettingsRow href="/onboarding" icon={ListChecks} title="Onboarding" description="View onboarding guides and important resources" />
              <SettingsRow href="/settings" icon={SettingsIcon} title="Settings" description="Manage your account and app settings" />
            </CardContent>
          </Card>
        </div>

        {/* ---------- Right rail ---------- */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/40">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                <Wallet className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-muted-foreground">Allowance balance</span>
            </div>
            <div className="mt-3 text-3xl font-bold tabular-nums">
              {formatCents(totalBalanceCents, balances[0]?.currency)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {balances.length === 0 ? (
                "No active allowance period"
              ) : (
                <>
                  Active period
                  {balances.map((b) => (
                    <span key={b.allowanceId} className="block font-medium text-foreground">
                      {b.periodLabel}
                    </span>
                  ))}
                </>
              )}
            </div>
            <Link
              href="/allowances"
              className="mt-4 flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              View allowance
            </Link>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col pt-0">
              <QuickAction href="/shop" icon={ShoppingBag} label="Shop now" />
              <QuickAction href="/orders" icon={Package} label="View orders" />
              <QuickAction href="/tasks" icon={ListChecks} label="My tasks" />
              <QuickAction href="/announcements" icon={Megaphone} label="Announcements" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Security
              </CardTitle>
              <p className="text-xs text-muted-foreground">Keep your account secure</p>
            </CardHeader>
            <CardContent className="pt-0">
              <ChangePasswordDialog />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AccessTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function SettingsRow({ href, icon: Icon, title, description }: { href: string; icon: LucideIcon; title: string; description: string }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 border-b border-border py-2 last:border-0 hover:bg-muted">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-3 border-b border-border py-1.5 last:border-0 hover:bg-muted">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
