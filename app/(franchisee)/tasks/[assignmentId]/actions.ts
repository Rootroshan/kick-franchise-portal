"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { completeTaskAssignment } from "@/server/modules/tasks/service";

/** Complete the caller's own task assignment (idempotent, location-scoped in the service). */
export async function completeAssignmentAction(assignmentId: string) {
  const ctx = await requireRole("FRANCHISEE_USER")();
  await completeTaskAssignment(ctx, assignmentId);
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${assignmentId}`);
}
