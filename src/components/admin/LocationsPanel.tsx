"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/fetchJson";

type Location = { id: string; name: string; address: string | null; status: string };

export function LocationsPanel({ tenantId, initialLocations }: { tenantId: string; initialLocations: Location[] }) {
  const [locations, setLocations] = useState(initialLocations);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { location } = await fetchJson<{ location: Location }>(`/api/admin/tenants/${tenantId}/locations`, {
        method: "POST",
        body: JSON.stringify({ name, address: address || undefined }),
      });
      setLocations((prev) => [...prev, location]);
      setName("");
      setAddress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create location");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {locations.map((l) => (
          <li key={l.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span className="font-medium">{l.name}</span>
            <span className="text-muted-foreground">{l.address ?? "—"}</span>
          </li>
        ))}
        {locations.length === 0 && <p className="text-sm text-muted-foreground">No locations yet.</p>}
      </ul>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input placeholder="Location name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        </div>
        <div className="flex-1">
          <Input placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} />
        </div>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Adding…" : "Add location"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
