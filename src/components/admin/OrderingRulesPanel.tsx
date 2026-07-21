"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchJson } from "@/lib/fetchJson";

type Rule = {
  id: string;
  locationName: string;
  productName: string | null;
  minQty: number | null;
  maxQty: number | null;
  cadenceDays: number | null;
};

export function OrderingRulesPanel({
  locations,
  products,
  initialRules,
}: {
  locations: { id: string; name: string }[];
  products: { id: string; name: string }[];
  initialRules: Rule[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [productId, setProductId] = useState("");
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [cadenceDays, setCadenceDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { rule } = await fetchJson<{ rule: { id: string; locationId: string; productId: string | null; minQty: number | null; maxQty: number | null; cadenceDays: number | null } }>(
        "/api/commerce/ordering-rules",
        {
          method: "POST",
          body: JSON.stringify({
            locationId,
            productId: productId || undefined,
            minQty: minQty === "" ? undefined : Number(minQty),
            maxQty: maxQty === "" ? undefined : Number(maxQty),
            cadenceDays: cadenceDays === "" ? undefined : Number(cadenceDays),
          }),
        }
      );
      setRules((prev) => [
        {
          id: rule.id,
          locationName: locations.find((l) => l.id === locationId)?.name ?? "",
          productName: productId ? products.find((p) => p.id === productId)?.name ?? null : null,
          minQty: rule.minQty,
          maxQty: rule.maxQty,
          cadenceDays: rule.cadenceDays,
        },
        ...prev,
      ]);
      setMinQty("");
      setMaxQty("");
      setCadenceDays("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="grid gap-2 sm:grid-cols-6 sm:items-end">
        <div className="sm:col-span-2">
          <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <Input placeholder="Min qty" type="number" min="1" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
        <Input placeholder="Max qty" type="number" min="1" value={maxQty} onChange={(e) => setMaxQty(e.target.value)} />
        <Input
          placeholder="Cadence days"
          type="number"
          min="1"
          value={cadenceDays}
          onChange={(e) => setCadenceDays(e.target.value)}
          className="sm:col-span-2"
        />
        <Button type="submit" size="sm" disabled={submitting} className="sm:col-span-2">
          {submitting ? "Creating…" : "Create rule"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="scrollbar-hide overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4">Location</th>
              <th className="py-2 pr-4">Product</th>
              <th className="py-2 pr-4">Min</th>
              <th className="py-2 pr-4">Max</th>
              <th className="py-2 pr-4">Cadence (days)</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-border/50">
                <td className="py-2 pr-4">{r.locationName}</td>
                <td className="py-2 pr-4">{r.productName ?? "All products"}</td>
                <td className="py-2 pr-4">{r.minQty ?? "—"}</td>
                <td className="py-2 pr-4">{r.maxQty ?? "—"}</td>
                <td className="py-2 pr-4">{r.cadenceDays ?? "—"}</td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted-foreground">
                  No ordering rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
