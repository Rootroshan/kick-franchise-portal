import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { completeTaskAssignment } from "@/server/modules/tasks/service";

/** [U]: marks this location's assignment complete. Never affects other locations' assignments. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("FRANCHISEE_USER")();
  const parts = new URL(req.url).pathname.split("/");
  const id = parts[parts.length - 2]!; // .../task-assignments/:id/complete
  const assignment = await completeTaskAssignment(ctx, id);
  return Response.json({ assignment });
});
