import Link from "next/link";
import { Users2, UserCheck, UserX, ShieldCheck, UsersRound } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listUsers, getUserKpis } from "@/server/modules/users/service";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { PageHeader, KPIStatCard, EmptyState, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { UsersListSection } from "@/components/admin/users/UsersListSection";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const status = typeof searchParams.status === "string" ? searchParams.status : "";

  const [{ rows, total }, kpis, brandOptions] = await Promise.all([
    listUsers(ctx, {
      search: q.search,
      role: q.raw.role,
      status,
      brand: q.brand,
      page: q.page,
      limit: q.limit,
    }),
    getUserKpis(ctx),
    getBrandFilterOptions(ctx),
  ]);

  const pages = pageCount(total, q.limit);

  return (
    <div>
      <PageHeader title="Users" description="Manage users, roles, and access across the platform." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Total Users" value={kpis.total} icon={Users2} tone="info" />
        <KPIStatCard label="Active Users" value={kpis.active} icon={UserCheck} tone="success" />
        <KPIStatCard label="Inactive Users" value={kpis.inactive} icon={UserX} tone="warning" />
        <KPIStatCard label="Super Admins" value={kpis.superAdmins} icon={ShieldCheck} tone="purple" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Status tabs — plain links so they survive without JS and keep the
            filter in the URL, matching how the other admin lists work. */}
        <nav className="flex items-center gap-1 border-b border-border" aria-label="Filter by status">
          <StatusTab label="All Users" href={buildHref("/admin/users", q.raw, { status: "", page: 1 })} active={!status} />
          <StatusTab label="Active" count={kpis.active} href={buildHref("/admin/users", q.raw, { status: "active", page: 1 })} active={status === "active"} />
          <StatusTab label="Inactive" count={kpis.inactive} href={buildHref("/admin/users", q.raw, { status: "inactive", page: 1 })} active={status === "inactive"} />
        </nav>

        <CreateUserDialog brandOptions={brandOptions} />
      </div>

      <ListToolbar
        searchPlaceholder="Search by name, email or phone…"
        filters={[
          { key: "brand", label: "Brand", options: brandOptions },
          {
            key: "role",
            label: "Role",
            options: [
              { value: "KICK_ADMIN", label: "Super Admin" },
              { value: "FRANCHISOR_ADMIN", label: "Franchisor Admin" },
              { value: "FRANCHISEE_USER", label: "Franchisee User" },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No users found"
          description={q.search || q.raw.role || q.brand || status ? "Try different filters." : "Create a user to get started."}
          icon={UsersRound}
        />
      ) : (
        <UsersListSection rows={rows} currentUserId={ctx.userId} brandOptions={brandOptions} total={total} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="mt-3 text-xs text-muted-foreground">
          Showing {rows.length} of {total} user{total === 1 ? "" : "s"}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <RowsPerPage current={q.limit} raw={q.raw} />
          <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/users", q.raw, { page: p })} />
        </div>
      </div>
    </div>
  );
}

function StatusTab({ label, count, href, active }: { label: string; count?: number; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium",
        active ? "border-status-info text-status-info" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      {count !== undefined && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{count}</span>
      )}
    </Link>
  );
}

function RowsPerPage({ current, raw }: { current: number; raw: Record<string, string> }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {[10, 20, 50].map((n) => (
        <Link
          key={n}
          href={buildHref("/admin/users", raw, { limit: n, page: 1 })}
          className={cn(
            "rounded-md border px-2 py-1 font-medium",
            current === n ? "border-status-info text-status-info" : "border-border hover:bg-muted"
          )}
        >
          {n}
        </Link>
      ))}
      <span>/ page</span>
    </div>
  );
}
