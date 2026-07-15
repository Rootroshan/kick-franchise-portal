"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/utils";
import { fetchJson } from "@/lib/fetchJson";

export type Variant = {
  id: string;
  productId: string;
  name: string;
  priceCents: number;
  currency: string;
  stock: number | null;
  active: boolean;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  active: boolean;
  variants: Variant[];
};

export function CommercePanel({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);

  function upsertProduct(product: Product) {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      if (idx === -1) return [product, ...prev];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...product };
      return copy;
    });
  }

  function upsertVariant(productId: string, variant: Variant) {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const idx = p.variants.findIndex((v) => v.id === variant.id);
        const variants = idx === -1 ? [...p.variants, variant] : p.variants.map((v) => (v.id === variant.id ? variant : v));
        return { ...p, variants };
      })
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <NewProductForm onCreated={upsertProduct} />
      <ul className="flex flex-col gap-4">
        {products.map((product) => (
          <li key={product.id} className="rounded-md border border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{product.name}</p>
                <p className="text-xs text-muted-foreground">SKU {product.sku}</p>
              </div>
              <Badge variant={product.active ? "success" : "muted"}>{product.active ? "Active" : "Inactive"}</Badge>
            </div>

            <ul className="flex flex-col gap-2">
              {product.variants.map((variant) => (
                <VariantRow key={variant.id} variant={variant} onUpdated={(v) => upsertVariant(product.id, v)} />
              ))}
              {product.variants.length === 0 && <p className="text-sm text-muted-foreground">No variants yet.</p>}
            </ul>

            <NewVariantForm productId={product.id} onCreated={(v) => upsertVariant(product.id, v)} />
          </li>
        ))}
        {products.length === 0 && <p className="text-sm text-muted-foreground">No products yet.</p>}
      </ul>
    </div>
  );
}

function NewProductForm({ onCreated }: { onCreated: (p: Product) => void }) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { product } = await fetchJson<{ product: Omit<Product, "variants"> }>("/api/commerce/products", {
        method: "POST",
        body: JSON.stringify({ name, sku }),
      });
      onCreated({ ...product, variants: [] });
      setName("");
      setSku("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
      </div>
      <div className="flex-1">
        <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} required maxLength={100} />
      </div>
      <Button type="submit" size="sm" disabled={submitting}>
        {submitting ? "Creating…" : "New product"}
      </Button>
      {error && <p className="text-sm text-destructive sm:basis-full">{error}</p>}
    </form>
  );
}

function NewVariantForm({ productId, onCreated }: { productId: string; onCreated: (v: Variant) => void }) {
  const [name, setName] = useState("");
  const [priceCents, setPriceCents] = useState("");
  const [stock, setStock] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { variant } = await fetchJson<{ variant: Variant }>("/api/commerce/variants", {
        method: "POST",
        body: JSON.stringify({
          productId,
          name,
          priceCents: Math.round(Number(priceCents) * 100),
          stock: stock === "" ? undefined : Number(stock),
        }),
      });
      onCreated(variant);
      setName("");
      setPriceCents("");
      setStock("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create variant");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input placeholder="Variant name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
      </div>
      <div className="w-28">
        <Input
          placeholder="Price ($)"
          type="number"
          step="0.01"
          min="0"
          value={priceCents}
          onChange={(e) => setPriceCents(e.target.value)}
          required
        />
      </div>
      <div className="w-24">
        <Input placeholder="Stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={submitting}>
        {submitting ? "Adding…" : "Add variant"}
      </Button>
      {error && <p className="text-sm text-destructive sm:basis-full">{error}</p>}
    </form>
  );
}

function VariantRow({ variant, onUpdated }: { variant: Variant; onUpdated: (v: Variant) => void }) {
  const [priceCents, setPriceCents] = useState(String(variant.priceCents / 100));
  const [stock, setStock] = useState(variant.stock === null ? "" : String(variant.stock));
  const [active, setActive] = useState(variant.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: Partial<{ priceCents: number; stock: number | null; active: boolean }>) {
    setSaving(true);
    setError(null);
    try {
      const { variant: updated } = await fetchJson<{ variant: Variant }>(`/api/commerce/variants/${variant.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      onUpdated(updated);
      setPriceCents(String(updated.priceCents / 100));
      setStock(updated.stock === null ? "" : String(updated.stock));
      setActive(updated.active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update variant");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-md bg-muted/40 p-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium">{variant.name}</span>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-24"
          type="number"
          step="0.01"
          min="0"
          value={priceCents}
          onChange={(e) => setPriceCents(e.target.value)}
          onBlur={() => save({ priceCents: Math.round(Number(priceCents) * 100) })}
        />
        <Input
          className="w-20"
          type="number"
          min="0"
          placeholder="Stock"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          onBlur={() => save({ stock: stock === "" ? null : Number(stock) })}
        />
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={active}
            disabled={saving}
            onChange={(e) => {
              setActive(e.target.checked);
              save({ active: e.target.checked });
            }}
          />
          Active
        </label>
        <span className="text-xs text-muted-foreground">{formatCents(variant.priceCents, variant.currency)}</span>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  );
}
