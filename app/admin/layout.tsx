import { redirect } from "next/navigation";
import { getRequestContext } from "@/server/modules/identity/requestContext";
import { HttpError } from "@/server/modules/identity/errors";
import { AdminShell } from "@/components/layout/AdminShell";
import { getUnreadCount } from "@/server/modules/notifications/inbox";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let userName = "Kick Admin";
  let ctx;
  try {
    ctx = await getRequestContext();
    if (ctx.role !== "KICK_ADMIN") redirect("/");
    userName = ctx.userId === "dev-bypass-user" ? "Kick Admin" : userName;
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 401) redirect("/sign-in");
      redirect("/");
    }
    throw err;
  }

  // Badge = the caller's UNREAD message count, so opening and reading a
  // notification actually clears it. It previously counted live operational
  // conditions (overdue tasks + failed orders + unverified domains), which
  // have no read state — the number could never go down by visiting the page,
  // and it disagreed with the figures shown on that page.
  const unread = await getUnreadCount(ctx).catch(() => 0);
  const badges = { notifications: unread };

  return (
    <AdminShell roleLabel="Super Admin" userName={userName} badges={badges}>
      {children}
    </AdminShell>
  );
}
