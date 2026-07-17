import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getRequestContext } from "@/server/modules/identity/requestContext";
import { HttpError } from "@/server/modules/identity/errors";
import { isDevBypassEnabled } from "@/lib/devBypass";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/commerce", label: "Commerce" },
  { href: "/admin/ordering-rules", label: "Ordering Rules" },
  { href: "/admin/allowances", label: "Allowances" },
  { href: "/admin/allowances/usage-report", label: "Usage Report" },
  { href: "/admin/rebates", label: "Rebates" },
  { href: "/admin/rebates/reports", label: "Rebate Reports" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/audit-log", label: "Audit Log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    const ctx = await getRequestContext();
    if (ctx.role !== "KICK_ADMIN") {
      redirect("/");
    }
  } catch (err) {
    if (err instanceof HttpError) {
      redirect("/");
    }
    throw err;
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-border bg-card lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between p-4 lg:flex-col lg:items-stretch lg:gap-4">
          <div className="text-lg font-bold">Kick Admin</div>
          <nav className="flex flex-wrap gap-1 lg:flex-col">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden lg:block lg:pt-4">
            {!isDevBypassEnabled() && <UserButton afterSignOutUrl="/" />}
          </div>
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
