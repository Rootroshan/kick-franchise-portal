"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCents } from "@/lib/utils";
import { fetchJson } from "@/lib/fetchJson";

type Allowance = {
  id: string;
  locationName: string;
  periodLabel: string;
  grantedCents: number;
  currency: string;
  overflow: "BLOCK" | "CHARGE_CARD";
};

export function AllowancesPanel({
  locations,
  initialAllowances,
}: {
  locations: { id: string; name: string }[];
  initialAllowances: Allowance[];
}) {
  const [allowances, setAllowances] = useState(initialAllowances);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [periodLabel, setPeriodLabel] = useState("");
  const [grantedDollars, setGrantedDollars] = useState("");
  const [overflow, setOverflow] = useState<"BLOCK" | "CHARGE_CARD">("CHARGE_CARD");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { allowance } = await fetchJson<{
        allowance: { id: string; periodLabel: string; grantedCents: number; currency: string; overflow: "BLOCK" | "CHARGE_CARD" };
      }>("/api/allowances", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          periodLabel,
          grantedCents: Math.round(Number(grantedDollars) * 100),
          overflow,
        }),
      });
      setAllowances((prev) => [
        {
          id: allowance.id,
          locationName: locations.find((l) => l.id === locationId)?.name ?? "",
          periodLabel: allowance.periodLabel,
          grantedCents: allowance.grantedCents,
          currency: allowance.currency,
          overflow: allowance.overflow,
        },
        ...prev,
      ]);
      setPeriodLabel("");
      setGrantedDollars("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant allowance");
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
        <Input
          placeholder="2026-Q3"
          value={periodLabel}
          onChange={(e) => setPeriodLabel(e.target.value)}
          required
          pattern="\d{4}-(Q[1-4]|M(0[1-9]|1[0-2]))"
          title="Format: YYYY-Q# or YYYY-M##"
        />
        <Input
          placeholder="Amount ($)"
          type="number"
          step="0.01"
          min="0"
          value={grantedDollars}
          onChange={(e) => setGrantedDollars(e.target.value)}
          required
        />
        <Select value={overflow} onChange={(e) => setOverflow(e.target.value as typeof overflow)}>
          <option value="CHARGE_CARD">Overflow: charge card</option>
          <option value="BLOCK">Overflow: block</option>
        </Select>
        <Button type="submit" size="sm" disabled={submitting} className="sm:col-span-1">
          {submitting ? "Granting…" : "Grant"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4">Location</th>
              <th className="py-2 pr-4">Period</th>
              <th className="py-2 pr-4">Granted</th>
              <th className="py-2 pr-4">Overflow</th>
            </tr>
          </thead>
          <tbody>
            {allowances.map((a) => (
              <tr key={a.id} className="border-b border-border/50">
                <td className="py-2 pr-4">{a.locationName}</td>
                <td className="py-2 pr-4">{a.periodLabel}</td>
                <td className="py-2 pr-4">{formatCents(a.grantedCents, a.currency)}</td>
                <td className="py-2 pr-4">{a.overflow}</td>
              </tr>
            ))}
            {allowances.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-muted-foreground">
                  No allowances granted yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
