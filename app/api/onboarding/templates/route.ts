import { requireRole, requireTenantRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { createOnboardingTemplate, listOnboardingTemplates } from "@/server/modules/onboarding/service";
import { createOnboardingTemplateSchema } from "@/server/modules/onboarding/schemas";

/** [K,F,U]: list templates. */
export const GET = withErrorHandling(async () => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN", "FRANCHISEE_USER")();
  const templates = await listOnboardingTemplates(ctx, ctx.tenantId);
  return Response.json({ templates });
});

/** [K,F]: create a reusable onboarding template. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireTenantRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const input = await parseJsonBody(req, createOnboardingTemplateSchema);
  const template = await createOnboardingTemplate(ctx, ctx.tenantId, input);
  return Response.json({ template }, { status: 201 });
});
