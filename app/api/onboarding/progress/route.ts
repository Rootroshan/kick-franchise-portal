import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody, parseSearchParams } from "@/server/lib/apiHandler";
import { markOnboardingProgress, getOwnOnboardingProgress, getTemplateProgressOverview } from "@/server/modules/onboarding/service";
import { markProgressSchema } from "@/server/modules/onboarding/schemas";

const querySchema = z.object({ templateId: z.string().uuid() });

/**
 * [K,F,U]: franchisee gets their own checklist + percent complete;
 * admins get the per-location overview (stuck-location visibility).
 */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN", "FRANCHISEE_USER")();
  const { templateId } = parseSearchParams(req.url, querySchema);

  if (ctx.role === "FRANCHISEE_USER") {
    const progress = await getOwnOnboardingProgress(ctx, templateId);
    return Response.json({ progress });
  }
  const overview = await getTemplateProgressOverview(ctx, templateId);
  return Response.json({ overview });
});

const bodySchema = markProgressSchema.extend({ templateId: z.string().uuid() });

/** [U]: mark a checklist item done/undone for the caller's own location. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("FRANCHISEE_USER")();
  const input = await parseJsonBody(req, bodySchema);
  const progress = await markOnboardingProgress(ctx, input.templateId, { itemId: input.itemId, done: input.done });
  return Response.json({ progress });
});
