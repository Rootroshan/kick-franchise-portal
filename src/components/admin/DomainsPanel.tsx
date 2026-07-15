"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchJson } from "@/lib/fetchJson";

type Domain = { id: string; hostname: string; status: "PENDING" | "VERIFIED" | "FAILED" };
type DnsInstructions = { type: string; name: string; value: string; cnameTarget: string };

const STATUS_VARIANT: Record<Domain["status"], "success" | "warning" | "destructive"> = {
  VERIFIED: "success",
  PENDING: "warning",
  FAILED: "destructive",
};

export function DomainsPanel({ tenantId, initialDomains }: { tenantId: string; initialDomains: Domain[] }) {
  const [domains, setDomains] = useState(initialDomains);
  const [hostname, setHostname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [lastInstructions, setLastInstructions] = useState<DnsInstructions | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await fetchJson<{ domain: Domain; dnsInstructions: DnsInstructions }>(
        `/api/admin/tenants/${tenantId}/domains`,
        { method: "POST", body: JSON.stringify({ hostname }) }
      );
      setDomains((prev) => [...prev, result.domain]);
      setLastInstructions(result.dnsInstructions);
      setHostname("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create domain");
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerify(domainId: string) {
    setError(null);
    setVerifyingId(domainId);
    try {
      const { domain } = await fetchJson<{ domain: Domain }>(
        `/api/admin/tenants/${tenantId}/domains/${domainId}/verify`,
        { method: "POST" }
      );
      setDomains((prev) => prev.map((d) => (d.id === domainId ? domain : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {domains.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <span className="font-medium">{d.hostname}</span>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[d.status]}>{d.status}</Badge>
              {d.status !== "VERIFIED" && (
                <Button size="sm" variant="outline" disabled={verifyingId === d.id} onClick={() => onVerify(d.id)}>
                  {verifyingId === d.id ? "Verifying…" : "Verify"}
                </Button>
              )}
            </div>
          </li>
        ))}
        {domains.length === 0 && <p className="text-sm text-muted-foreground">No custom domains yet.</p>}
      </ul>

      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            placeholder="orders.example.com"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            required
            maxLength={255}
          />
        </div>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Adding…" : "Add domain"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {lastInstructions && (
        <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
          <p className="mb-2 font-medium">Add this DNS TXT record before verifying:</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{lastInstructions.type}</dd>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="break-all">{lastInstructions.name}</dd>
            <dt className="text-muted-foreground">Value</dt>
            <dd className="break-all">{lastInstructions.value}</dd>
            <dt className="text-muted-foreground">CNAME target</dt>
            <dd className="break-all">{lastInstructions.cnameTarget}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
