"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchJson } from "@/lib/fetchJson";

type Domain = { id: string; hostname: string; status: "PENDING" | "VERIFIED" | "FAILED" };
type DnsRecord = { type: string; name: string; shortName: string; value: string; ttl: string; purpose: string };
type DnsInstructions = { ownership: DnsRecord; routing: DnsRecord };
type LiveStatus =
  | "NOT_CONFIGURED"
  | "DNS_REQUIRED"
  | "PENDING_DNS"
  | "OWNERSHIP_VERIFIED"
  | "CNAME_VERIFIED"
  | "SSL_PROVISIONING"
  | "ACTIVE"
  | "FAILED";

const STATUS_VARIANT: Record<Domain["status"], "success" | "warning" | "destructive"> = {
  VERIFIED: "success",
  PENDING: "warning",
  FAILED: "destructive",
};

// Live status is a finer-grained read on top of the DB status (spec: never
// show "verified" from a DB flag alone) — labelled distinctly so an operator
// can tell "TXT proved ownership" apart from "actually serving traffic."
const LIVE_STATUS_LABEL: Record<LiveStatus, string> = {
  NOT_CONFIGURED: "Hosting not configured",
  DNS_REQUIRED: "DNS required",
  PENDING_DNS: "Pending DNS",
  OWNERSHIP_VERIFIED: "Ownership verified",
  CNAME_VERIFIED: "CNAME verified",
  SSL_PROVISIONING: "SSL provisioning",
  ACTIVE: "Active",
  FAILED: "Failed",
};

const LIVE_STATUS_VARIANT: Record<LiveStatus, "success" | "warning" | "destructive"> = {
  NOT_CONFIGURED: "warning",
  DNS_REQUIRED: "warning",
  PENDING_DNS: "warning",
  OWNERSHIP_VERIFIED: "warning",
  CNAME_VERIFIED: "warning",
  SSL_PROVISIONING: "warning",
  ACTIVE: "success",
  FAILED: "destructive",
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-6 px-2 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : `Copy ${label}`}
    </Button>
  );
}

export function DomainsPanel({ tenantId, initialDomains }: { tenantId: string; initialDomains: Domain[] }) {
  const [domains, setDomains] = useState(initialDomains);
  const [hostname, setHostname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<Record<string, { status: LiveStatus; detail?: string }>>({});
  const [lastInstructions, setLastInstructions] = useState<{ domainId: string; data: DnsInstructions } | null>(null);

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
      setLastInstructions({ domainId: result.domain.id, data: result.dnsInstructions });
      setHostname("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create domain");
    } finally {
      setSubmitting(false);
    }
  }

  async function onRefresh(domainId: string) {
    setRefreshingId(domainId);
    try {
      const result = await fetchJson<{ status: LiveStatus; detail?: string }>(
        `/api/admin/tenants/${tenantId}/domains/${domainId}`,
        { method: "GET" }
      );
      setLiveStatus((prev) => ({ ...prev, [domainId]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh domain status");
    } finally {
      setRefreshingId(null);
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
      // Ownership passing does not mean serving — immediately check live
      // hosting state so the badge doesn't sit on a bare "VERIFIED" claim.
      await onRefresh(domainId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {domains.map((d) => {
          const live = liveStatus[d.id];
          return (
            <li key={d.id} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="break-all font-medium">{d.hostname}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_VARIANT[d.status]}>{d.status}</Badge>
                  {live && <Badge variant={LIVE_STATUS_VARIANT[live.status]}>{LIVE_STATUS_LABEL[live.status]}</Badge>}
                  {d.status !== "VERIFIED" && (
                    <Button size="sm" variant="outline" disabled={verifyingId === d.id} onClick={() => onVerify(d.id)}>
                      {verifyingId === d.id ? "Verifying…" : "Verify Domain"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={refreshingId === d.id}
                    onClick={() => onRefresh(d.id)}
                  >
                    {refreshingId === d.id ? "Refreshing…" : "Refresh Status"}
                  </Button>
                </div>
              </div>
              {live?.detail && <p className="text-xs text-muted-foreground">{live.detail}</p>}
            </li>
          );
        })}
        {domains.length === 0 && <p className="text-sm text-muted-foreground">No custom domains yet.</p>}
      </ul>

      {/* Always stacked, never side-by-side: this panel renders inside a
          narrow rail column, and sm:flex-row matches viewport width, not
          the column's own width — at a wide viewport it forced the input
          and button onto one row even when the column itself was ~250px,
          truncating the placeholder and cramping the button. */}
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <Input
          placeholder="portal.example.com"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          required
          maxLength={255}
        />
        <Button type="submit" size="sm" disabled={submitting} className="w-full">
          {submitting ? "Adding…" : "Add domain"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {lastInstructions && (
        <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">DNS records to add</p>
            <div className="flex items-center gap-1">
              <CopyButton
                label="All"
                value={[
                  `CNAME ${lastInstructions.data.routing.shortName} -> ${lastInstructions.data.routing.value}`,
                  `TXT ${lastInstructions.data.ownership.shortName} -> ${lastInstructions.data.ownership.value}`,
                ].join("\n")}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setLastInstructions(null)}
              >
                Verify Later
              </Button>
            </div>
          </div>

          <p className="mb-1 text-xs font-semibold text-muted-foreground">{lastInstructions.data.routing.purpose}</p>
          <dl className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{lastInstructions.data.routing.type}</dd>
            <span />
            <dt className="text-muted-foreground">Name</dt>
            <dd className="break-all">{lastInstructions.data.routing.shortName}</dd>
            <CopyButton label="Name" value={lastInstructions.data.routing.shortName} />
            <dt className="text-muted-foreground">Value</dt>
            <dd className="break-all">{lastInstructions.data.routing.value}</dd>
            <CopyButton label="Value" value={lastInstructions.data.routing.value} />
            <dt className="text-muted-foreground">TTL</dt>
            <dd>{lastInstructions.data.routing.ttl}</dd>
            <span />
          </dl>

          <p className="mb-1 text-xs font-semibold text-muted-foreground">{lastInstructions.data.ownership.purpose}</p>
          <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{lastInstructions.data.ownership.type}</dd>
            <span />
            <dt className="text-muted-foreground">Name</dt>
            <dd className="break-all">{lastInstructions.data.ownership.shortName}</dd>
            <CopyButton label="Name" value={lastInstructions.data.ownership.shortName} />
            <dt className="text-muted-foreground">Value</dt>
            <dd className="break-all">{lastInstructions.data.ownership.value}</dd>
            <CopyButton label="Value" value={lastInstructions.data.ownership.value} />
            <dt className="text-muted-foreground">TTL</dt>
            <dd>{lastInstructions.data.ownership.ttl}</dd>
            <span />
          </dl>

          <p className="mt-3 text-xs text-muted-foreground">
            Some DNS providers want only the short label above (e.g. <code>portal</code>); others show the full
            hostname automatically and fill it in for you — use whichever your provider expects.
          </p>
        </div>
      )}
    </div>
  );
}
