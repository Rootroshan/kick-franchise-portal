import { getRequestContext } from "@/server/modules/identity/requestContext";
import { listOnboardingTemplates, getOwnOnboardingProgress } from "@/server/modules/onboarding/service";
import { OnboardingChecklist } from "@/components/franchisee/OnboardingChecklist";

export default async function OnboardingPage() {
  const ctx = await getRequestContext();
  const templates = await listOnboardingTemplates(ctx, ctx.tenantId!);

  const withProgress = await Promise.all(
    templates.map(async (t) => ({
      templateId: t.id,
      name: t.name,
      progress: await getOwnOnboardingProgress(ctx, t.id),
    }))
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Onboarding</h1>
      {withProgress.length === 0 && <p className="text-sm text-muted-foreground">No onboarding templates yet.</p>}
      {withProgress.map((t) => (
        <OnboardingChecklist
          key={t.templateId}
          templateId={t.templateId}
          name={t.name}
          percentComplete={t.progress.percentComplete}
          checklist={t.progress.checklist.map((c) => ({
            ...c,
            doneAt: c.doneAt ? c.doneAt.toISOString() : null,
          }))}
        />
      ))}
    </div>
  );
}
