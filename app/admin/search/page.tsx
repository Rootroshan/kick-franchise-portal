import Link from "next/link";
import { requireRole } from "@/server/modules/identity/guard";
import { adminSearch } from "@/server/modules/dashboard/search";
import { Badge } from "@/components/ui/badge";

export default async function AdminSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = (searchParams.q ?? "").trim();
  const results = await adminSearch(ctx, q);
  const total = results.brands.length + results.stores.length + results.users.length + results.orders.length + results.products.length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Search results</h1>
        <p className="text-sm text-muted-foreground">
          {q.length < 2 ? "Type at least 2 characters." : `${total} result${total === 1 ? "" : "s"} for “${q}”`}
        </p>
      </div>

      <Section title="Brands" items={results.brands} render={(b) => (
        <Link key={b.id} href={`/admin/tenants/${b.id}`} className="block rounded-lg border border-border bg-card p-3 hover:bg-muted">
          <div className="font-medium">{b.name}</div>
          <div className="text-xs text-muted-foreground">{b.slug}</div>
        </Link>
      )} />

      <Section title="Stores" items={results.stores} render={(s) => (
        <div key={s.id} className="rounded-lg border border-border bg-card p-3">
          <div className="font-medium">{s.name}</div>
          <div className="text-xs text-muted-foreground">{s.tenantName}</div>
        </div>
      )} />

      <Section title="Users" items={results.users} render={(u) => (
        <div key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
          <div><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
          <Badge variant="secondary">{u.role}</Badge>
        </div>
      )} />

      <Section title="Orders" items={results.orders} render={(o) => (
        <Link key={o.id} href={`/admin/orders`} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:bg-muted">
          <div><div className="font-mono text-xs">{o.id.slice(0, 8)}</div><div className="text-xs text-muted-foreground">{o.tenantName} · {o.storeName}</div></div>
          <Badge variant="secondary">{o.status}</Badge>
        </Link>
      )} />

      <Section title="Products" items={results.products} render={(p) => (
        <Link key={p.id} href={`/admin/commerce`} className="rounded-lg border border-border bg-card p-3 hover:bg-muted">
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-muted-foreground">{p.sku} · {p.tenantName}</div>
        </Link>
      )} />

      {q.length >= 2 && total === 0 && <p className="text-sm text-muted-foreground">No matches found.</p>}
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
