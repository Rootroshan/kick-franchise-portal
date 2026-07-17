import Link from "next/link";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { getSettings } from "@/server/modules/franchisor-settings/service";
import { PageHeader } from "@/components/admin/kit";
import { ProfileForm, NotificationForm } from "@/components/franchisor/settings/SettingsForms";
import { updateProfileAction } from "./actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "profile", label: "Profile" },
  { value: "notifications", label: "Notifications" },
  { value: "brand", label: "Brand" },
];

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <span className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{value}</span>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const settings = await getSettings(ctx, ctx.tenantId);
  const tab = TABS.some((t) => t.value === searchParams.tab) ? searchParams.tab! : "profile";

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Manage your account and brand preferences." />

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/franchisor/settings?tab=${t.value}`}
            role="tab"
            aria-selected={tab === t.value}
            className={cn("shrink-0 border-b-2 px-4 py-2 text-sm font-medium", tab === t.value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        {tab === "profile" && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                {settings.profile.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "FA"}
              </span>
              <div>
                <div className="font-semibold">{settings.profile.displayName || "Franchisor Admin"}</div>
                <div className="text-xs text-muted-foreground">{settings.profile.role}</div>
              </div>
            </div>
            <ProfileForm action={updateProfileAction} defaults={settings.profile} />
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="mb-1 text-sm font-semibold">Security</h3>
              <p className="mb-2 text-xs text-muted-foreground">Password and active sessions are managed through your identity provider.</p>
              <button className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">Change Password</button>
            </div>
          </>
        )}

        {tab === "notifications" && <NotificationForm />}

        {tab === "brand" && (
          <>
            <dl className="grid gap-4 sm:grid-cols-2">
              <ReadOnly label="Public brand display name" value={settings.brand.displayName} />
              <ReadOnly label="Contact email" value={settings.brand.contactEmail || "Not set"} />
              <ReadOnly label="Contact phone" value={settings.brand.contactPhone || "Not set"} />
              <ReadOnly label="Timezone" value={settings.brand.timezone} />
            </dl>
            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              Brand identity, commerce settings, pricing, allowances, rebates, domains and platform configuration are controlled
              exclusively by Kick Media. Contact your Kick account manager to change these details.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
