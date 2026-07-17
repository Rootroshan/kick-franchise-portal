import { requireRole } from "@/server/modules/identity/guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PushOptIn } from "@/components/franchisee/PushOptIn";
import { NotificationPrefs } from "@/components/franchisee/NotificationPrefs";
import { LogoutButton } from "@/components/layout/LogoutButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireRole("FRANCHISEE_USER")();

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
          <NotificationPrefs />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Security</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          <p className="mb-1 w-full text-sm text-muted-foreground">Your password and sessions are managed through your identity provider.</p>
          <button className="min-h-11 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted">Change password</button>
          <LogoutButton variant="light" />
        </CardContent>
      </Card>
    </div>
  );
}
