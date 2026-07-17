import { redirect } from "next/navigation";
import { getRequestContext } from "@/server/modules/identity/requestContext";
import { HttpError } from "@/server/modules/identity/errors";
import { AdminShell } from "@/components/layout/AdminShell";
import { getAdminBadgeCounts } from "@/server/modules/dashboard/service";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let userName = "Kick Admin";
  try {
    const ctx = await getRequestContext();
    if (ctx.role !== "KICK_ADMIN") redirect("/");
    userName = ctx.userId === "dev-bypass-user" ? "Kick Admin" : userName;
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 401) redirect("/sign-in");
      redirect("/");
    }
    throw err;
  }

  const badges = await getAdminBadgeCounts().catch(() => ({ notifications: 0 }));

  return (
    <AdminShell roleLabel="Super Admin" userName={userName} badges={badges}>
      {children}
    </AdminShell>
  );
}
