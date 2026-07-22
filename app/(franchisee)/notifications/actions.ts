"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { markRead, markAllRead } from "@/server/modules/notifications/inbox";

/** Marks one notification read (scoped to the caller by markRead + RLS). */
export async function markNotificationReadAction(id: string): Promise<void> {
  const ctx = await requireRole("FRANCHISEE_USER")();
  await markRead(ctx, id);
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const ctx = await requireRole("FRANCHISEE_USER")();
  await markAllRead(ctx);
  revalidatePath("/notifications");
}
