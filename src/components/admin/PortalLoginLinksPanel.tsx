"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check, Globe2, ShieldCheck, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type DomainStatus = "PENDING" | "VERIFIED" | "FAILED";

const STATUS_VARIANT: Record<DomainStatus, "success" | "warning" | "destructive"> = {
  VERIFIED: "success",
  PENDING: "warning",
  FAILED: "destructive",
};

/**
 * Portal & Custom Domain — the brand's customer-facing portal plus its two
 * role-locked logins, shown on Brand Detail and the New Brand review step.
 *
 * Every URL is DERIVED from `hostname`, never stored: when the custom domain
 * changes, these update on next render with no separate write path to keep in
 * sync. `status` reflects the underlying CustomDomain row — same source the
 * "Custom Domains" panel uses — so this never claims "Verified" on its own
 * say-so.
 */
export function PortalLoginLinksPanel({
  hostname,
  status,
}: {
  hostname: string | null;
  status?: DomainStatus | null;
}) {
  if (!hostname) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold">Portal &amp; Custom Domain</h2>
        <p className="text-sm text-muted-foreground">Add a portal domain to generate the portal and login links.</p>
      </div>
    );
  }

  const portalUrl = `https://${hostname}`;
  const adminUrl = `${portalUrl}/admin-login`;
  const storeUrl = `${portalUrl}/store-login`;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Portal &amp; Custom Domain</h2>
      <p className="mb-3 text-xs text-muted-foreground">Your brand&rsquo;s customer-facing portal and login links.</p>

      <div className="flex flex-col gap-3">
        <LinkCard
          icon={Globe2}
          label="Custom Portal (Primary)"
          url={portalUrl}
          status={status}
          primary
        />
        <LinkCard icon={ShieldCheck} label="Franchise Admin Login" url={adminUrl} />
        <LinkCard icon={Store} label="Store User Login" url={storeUrl} />
      </div>
    </div>
  );
}

function LinkCard({
  icon: Icon,
  label,
  url,
  status,
  primary,
}: {
  icon: typeof Globe2;
  label: string;
  url: string;
  status?: DomainStatus | null;
  primary?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          {label}
        </span>
        {primary && status && <Badge variant={STATUS_VARIANT[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-2.5 flex items-center gap-1 break-all text-xs text-status-info hover:underline"
      >
        {url}
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
      </a>
      <div className="flex gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          {primary ? "Open Portal" : "Open"}
        </a>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
          className="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted"
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? "Copied" : "Copy Link"}
        </button>
      </div>
    </div>
  );
}
