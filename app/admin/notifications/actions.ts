"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { markRead, markAllRead } from "@/server/modules/notifications/inbox";

/** Mark a single notification read. Scoped to the caller's own rows in the service. */
export async function markReadAction(id: string) {
  const ctx = await requireRole("KICK_ADMIN")();
  await markRead(ctx, id);
  // Refresh the inbox and the shell (badge lives in the layout).
  revalidatePath("/admin/notifications");
  revalidatePath("/admin", "layout");
}

export async function markAllReadAction() {
  const ctx = await requireRole("KICK_ADMIN")();
  const count = await markAllRead(ctx);
  revalidatePath("/admin/notifications");
  revalidatePath("/admin", "layout");
  return count;
}
