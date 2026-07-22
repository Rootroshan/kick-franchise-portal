"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Filter,
  LayoutGrid,
  Loader2,
  Megaphone,
  Package,
  PackageOpen,
  RefreshCw,
  Search,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Coffee,
  Frame,
  Tag,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/utils";
import { useCart } from "@/components/franchisee/CartContext";

export type CatalogVariant = { id: string; name: string; priceCents: number; currency: string; stock: number | null };
export type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  createdAt: string; // ISO — serialized across the server/client boundary
  variants: CatalogVariant[];
};

export type ShopAllowance = {
  periodLabel: string;
  currency: string;
  grantedCents: number;
  usedCents: number;
  balanceCents: number;
};

const CATEGORY_META: Record<string, { icon: typeof Shirt; blurb: string; tint: string }> = {
  Apparel: { icon: Shirt, blurb: "Clothing & uniforms", tint: "bg-indigo-500/10 text-indigo-500" },
  Kitchenware: { icon: Coffee, blurb: "Cups, mugs & more", tint: "bg-emerald-500/10 text-emerald-500" },
  Packaging: { icon: ShoppingBag, blurb: "Bags, boxes & wraps", tint: "bg-amber-500/10 text-amber-500" },
  Signage: { icon: Frame, blurb: "Indoor & outdoor", tint: "bg-sky-500/10 text-sky-500" },
  Promotional: { icon: Tag, blurb: "Marketing items", tint: "bg-violet-500/10 text-violet-500" },
};

const NEW_BADGE_DAYS = 30;

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_BADGE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Store User shop browser. Initial catalog is server-rendered; search and
 * category filters re-query the tenant-scoped /api/catalog endpoint with a
 * debounce and stale-request cancellation, so filtering never reloads the page.
 * Prices shown are display-only — checkout re-prices on the server.
 */
export function ShopBrowser({ initialProducts, allowance }: { initialProducts: CatalogProduct[]; allowance: ShopAllowance | null }) {
  const { items } = useCart();
  const router = useRouter();
  const cartCount = items.reduce((sum, i) => sum + i.qty, 0);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [products, setProducts] = useState<CatalogProduct[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category counts come from the full (unfiltered) initial catalog so the
  // cards stay stable while the grid below filters.
  const countsByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of initialProducts) {
      const key = p.category ?? "Uncategorised";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [initialProducts]);

  const filtering = q.trim().length > 0 || category !== null;

  // Debounced, cancellable server-side search. The unfiltered view reuses the
  // server-rendered list without refetching.
  useEffect(() => {
    if (!filtering) {
      setProducts(initialProducts);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (category) params.set("category", category);
        const res = await fetch(`/api/catalog?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to load products");
        const data = await res.json();
        setProducts(data.products);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError("Could not load products. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, category, filtering, initialProducts]);

  const gridHeading = category ?? (q.trim() ? "Search results" : "Featured products");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shop</h1>
        <p className="text-sm text-muted-foreground">Browse and order brand-approved products for your store.</p>
      </div>

      {/* Search / filter / cart toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, categories or SKU..."
            aria-label="Search products, categories or SKU"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted sm:flex-none"
          >
            <Filter className="h-4 w-4" aria-hidden="true" /> Filter
          </button>
          <Link
            href="/cart"
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted sm:flex-none"
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            View cart
            <span className="text-muted-foreground">
              {cartCount} item{cartCount === 1 ? "" : "s"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <CategoryChip label="All" active={category === null} onClick={() => setCategory(null)} />
          {Object.keys(CATEGORY_META).map((c) => (
            <CategoryChip key={c} label={c} active={category === c} onClick={() => setCategory(category === c ? null : c)} />
          ))}
        </div>
      )}

      {/* Allowance summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Allowance balance</p>
            <p className="text-3xl font-bold tabular-nums">
              {formatCents(allowance?.balanceCents ?? 0, allowance?.currency ?? "CAD")}
            </p>
            {allowance ? (
              <p className="text-sm text-muted-foreground">
                {allowance.periodLabel} · {formatCents(allowance.usedCents, allowance.currency)} used ·{" "}
                {formatCents(allowance.balanceCents, allowance.currency)} remaining
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No active allowance period</p>
            )}
          </div>
          <Link
            href="/allowances"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/30 bg-card px-4 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            <CreditCard className="h-4 w-4" aria-hidden="true" /> View allowance
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>

      {/* Categories */}
      <section aria-labelledby="shop-categories">
        <h2 id="shop-categories" className="mb-3 text-base font-semibold">
          Shop by category
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(CATEGORY_META).map(([name, meta]) => (
            <CategoryCard
              key={name}
              name={name}
              blurb={meta.blurb}
              icon={meta.icon}
              tint={meta.tint}
              count={countsByCategory.get(name) ?? 0}
              active={category === name}
              onClick={() => {
                setCategory(category === name ? null : name);
                setShowFilters(true);
              }}
            />
          ))}
          <CategoryCard
            name="All Products"
            blurb="View everything"
            icon={LayoutGrid}
            tint="bg-muted text-foreground"
            count={initialProducts.length}
            active={category === null && filtering}
            onClick={() => {
              setCategory(null);
              setQ("");
            }}
          />
        </div>
      </section>

      {/* Product grid */}
      <section aria-labelledby="shop-products" aria-busy={loading}>
        <h2 id="shop-products" className="mb-3 text-base font-semibold">
          {gridHeading}
        </h2>

        {loading && (
          <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading products…
          </p>
        )}

        {error && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-status-error/30 bg-status-error/5 px-3 py-2 text-sm text-status-error">
            <span>{error}</span>
            <button onClick={() => setQ((v) => v)} className="font-medium underline" type="button">
              Retry
            </button>
          </div>
        )}

        {products.length === 0 && !loading ? (
          <EmptyCatalog filtering={filtering} onReset={() => { setQ(""); setCategory(null); }} onRefresh={() => router.refresh()} />
        ) : (
          <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 rounded-full border px-4 text-sm font-medium ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

function CategoryCard({
  name,
  blurb,
  icon: Icon,
  tint,
  count,
  active,
  onClick,
}: {
  name: string;
  blurb: string;
  icon: typeof Shirt;
  tint: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors ${
        active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
      }`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-sm font-semibold">{name}</span>
      <span className="text-xs text-muted-foreground">{blurb}</span>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const from = product.variants[0]; // variants are server-sorted by price asc
  const allOut = product.variants.every((v) => v.stock !== null && v.stock <= 0);

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative flex aspect-square items-center justify-center bg-muted">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- tenant-supplied remote hosts aren't in next/image allowlist; lazy + sized container instead
          <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-full w-full object-contain p-4" />
        ) : (
          <Package className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
        )}
        {isNew(product.createdAt) && (
          <span className="absolute right-2 top-2 rounded-full bg-status-success/15 px-2 py-0.5 text-xs font-semibold text-status-success">
            New
          </span>
        )}
        {allOut && (
          <span className="absolute left-2 top-2 rounded-full bg-status-error/10 px-2 py-0.5 text-xs font-semibold text-status-error">
            Out of stock
          </span>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-sm font-semibold">{product.name}</p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {product.variants.length > 1 ? "From " : ""}
          {from ? formatCents(from.priceCents, from.currency) : "—"}
        </p>
        <Link
          href={`/shop/${product.id}`}
          className="mt-auto inline-flex min-h-9 items-center justify-center rounded-md border border-primary/40 pt-0.5 text-sm font-medium text-primary hover:bg-primary/5"
        >
          View details
        </Link>
      </CardContent>
    </Card>
  );
}

function EmptyCatalog({ filtering, onReset, onRefresh }: { filtering: boolean; onReset: () => void; onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <PackageOpen className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-base font-semibold">{filtering ? "No matching products" : "No products available"}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {filtering
            ? "Nothing matches your search or filter. Try a different term or category."
            : "Approved products haven't been added for your brand yet. Check back soon."}
        </p>
      </div>
      <div className="flex gap-2">
        {filtering ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Clear filters
          </button>
        ) : (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
          </button>
        )}
        <Link
          href="/"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
        >
          <Megaphone className="h-4 w-4" aria-hidden="true" /> Return to Feed
        </Link>
      </div>
    </div>
  );
}
