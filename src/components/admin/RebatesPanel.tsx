"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { fetchJson } from "@/lib/fetchJson";

type Rule = {
  id: string;
  productName: string;
  type: "FLAT" | "PERCENT";
  value: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export function RebatesPanel({ products, initialRules }: { products: { id: string; name: string }[]; initialRules: Rule[] }) {
  const [rules, setRules] = useState(initialRules);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [type, setType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [value, setValue] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { rule } = await fetchJson<{
        rule: { id: string; type: "FLAT" | "PERCENT"; value: number; effectiveFrom: string; effectiveTo: string | null };
      }>("/api/rebates/rules", {
        method: "POST",
        body: JSON.stringify({
          productId,
          type,
          value: Number(value),
          effectiveFrom,
          effectiveTo: effectiveTo || undefined,
        }),
      });
      setRules((prev) => [
        {
          id: rule.id,
          productName: products.find((p) => p.id === productId)?.name ?? "",
          type: rule.type,
          value: rule.value,
          effectiveFrom: rule.effectiveFrom,
          effectiveTo: rule.effectiveTo,
        },
        ...prev,
      ]);
      setValue("");
      setEffectiveFrom("");
      setEffectiveTo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rebate rule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="grid gap-2 sm:grid-cols-6 sm:items-end">
        <div className="sm:col-span-2">
          <Select value={productId} onChange={(e) => setProductId(e.target.value)} required>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="FLAT">Flat (cents)</option>
          <option value="PERCENT">Percent (bps)</option>
        </Select>
        <div>
          <Input
            placeholder={type === "PERCENT" ? "500 = 5%" : "Cents"}
            type="number"
            min="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
          {type === "PERCENT" && <p className="mt-1 text-xs text-muted-foreground">Basis points — 500 = 5%</p>}
        </div>
        <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
        <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} placeholder="Effective to (optional)" />
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Creating…" : "Create rule"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4">Product</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Value</th>
              <th className="py-2 pr-4">Effective from</th>
              <th className="py-2 pr-4">Effective to</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-border/50">
                <td className="py-2 pr-4">{r.productName}</td>
                <td className="py-2 pr-4">
                  <Badge variant="outline">{r.type}</Badge>
                </td>
                <td className="py-2 pr-4">{r.type === "PERCENT" ? `${(r.value / 100).toFixed(2)}%` : `$${(r.value / 100).toFixed(2)}`}</td>
                <td className="py-2 pr-4">{formatDate(r.effectiveFrom)}</td>
                <td className="py-2 pr-4">{r.effectiveTo ? formatDate(r.effectiveTo) : "—"}</td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted-foreground">
                  No rebate rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
