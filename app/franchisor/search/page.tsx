import Link from "next/link";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { franchisorSearch } from "@/server/modules/franchisor-dashboard/search";
import { PageHeader, StatusBadge } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

export default async function FranchisorSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const q = (searchParams.q ?? "").trim();
  const r = await franchisorSearch(ctx, ctx.tenantId, q);
  const total = r.announcements.length + r.artwork.length + r.tasks.length + r.onboarding.length + r.stores.length + r.users.length;

  return (
    <div>
      <PageHeader title="Search results" description={q.length < 2 ? "Type at least 2 characters." : `${total} result${total === 1 ? "" : "s"} for “${q}”`} />

      <div className="flex flex-col gap-6">
        <Section title="Announcements" items={r.announcements} render={(a) => (
          <Link key={a.id} href={`/franchisor/announcements/${a.id}`} className="block rounded-lg border border-border bg-card p-3 hover:bg-muted">
            <div className="text-sm font-medium">{a.title}</div>
          </Link>
        )} />
        <Section title="Artwork" items={r.artwork} render={(a) => (
          <Link key={a.id} href="/franchisor/artwork" className="block rounded-lg border border-border bg-card p-3 hover:bg-muted">
            <div className="text-sm font-medium">{a.name}</div>
            <div className="text-xs text-muted-foreground">{a.type}</div>
          </Link>
        )} />
        <Section title="Tasks" items={r.tasks} render={(t) => (
          <Link key={t.id} href={`/franchisor/tasks/${t.id}`} className="block rounded-lg border border-border bg-card p-3 hover:bg-muted">
            <div className="text-sm font-medium">{t.title}</div>
          </Link>
        )} />
        <Section title="Onboarding" items={r.onboarding} render={(o) => (
          <Link key={o.id} href="/franchisor/onboarding" className="block rounded-lg border border-border bg-card p-3 hover:bg-muted">
            <div className="text-sm font-medium">{o.name}</div>
          </Link>
        )} />
        <Section title="Stores" items={r.stores} render={(s) => (
          <Link key={s.id} href="/franchisor/stores" className="block rounded-lg border border-border bg-card p-3 hover:bg-muted">
            <div className="text-sm font-medium">{s.name}</div>
          </Link>
        )} />
        <Section title="Franchisee Users" items={r.users} render={(u) => (
          <div key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <span className="text-sm font-medium">{u.name}</span>
            <StatusBadge status={u.role} />
          </div>
        )} />

        {q.length >= 2 && total === 0 && <p className="text-sm text-muted-foreground">No matches found.</p>}
      </div>
    </div>
  );
}

function Section<T>({ title, items, render }: { title: string; items: T[]; render: (item: T) => React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{items.map(render)}</div>
    </section>
  );
}
