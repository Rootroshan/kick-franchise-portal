import { requireRole } from "@/server/modules/identity/guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PushOptIn } from "@/components/franchisee/PushOptIn";
import { NotificationPrefs } from "@/components/franchisee/NotificationPrefs";
import { getOwnNotificationPrefs } from "@/server/modules/notifications/prefs";
import { ChangePasswordDialog } from "@/components/franchisee/ChangePasswordDialog";
import { LogoutButton } from "@/components/layout/LogoutButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireRole("FRANCHISEE_USER")();
  const prefs = await getOwnNotificationPrefs(ctx);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Settings</h1>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Push notifications</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <PushOptIn />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Notification preferences</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <NotificationPrefs prefs={prefs} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Security</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          <ChangePasswordDialog />
          <div>
            <LogoutButton variant="light" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
