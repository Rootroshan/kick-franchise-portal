import { requireRole } from "@/server/modules/identity/guard";
import { listOnboardingTemplates } from "@/server/modules/onboarding/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingPanel } from "@/components/franchisor/OnboardingPanel";

export default async function OnboardingPage() {
  const ctx = await requireRole("FRANCHISOR_ADMIN")();
  const templates = await listOnboardingTemplates(ctx, ctx.tenantId!);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Onboarding</h1>
        <p className="text-sm text-muted-foreground">Build onboarding checklists and track per-location progress.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <OnboardingPanel
            initialTemplates={templates.map((t) => ({
              id: t.id,
              name: t.name,
              items: t.items.map((i) => ({ id: i.id, title: i.title, order: i.order })),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
