"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check, ShieldCheck, Store } from "lucide-react";

/** The two role-locked login links for one brand's portal domain — shown on Brand Detail and the New Brand review step. Never hardcoded per brand: built from whatever hostname is passed in. */
export function PortalLoginLinksPanel({ hostname }: { hostname: string | null }) {
  if (!hostname) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold">Portal Login Links</h2>
        <p className="text-sm text-muted-foreground">Add a portal domain to generate login links.</p>
      </div>
    );
  }

  const adminUrl = `https://${hostname}/admin-login`;
  const storeUrl = `https://${hostname}/store-login`;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">Portal Login Links</h2>
      <div className="flex flex-col gap-3">
        <LoginLinkCard icon={ShieldCheck} label="Franchise Admin Login" url={adminUrl} />
        <LoginLinkCard icon={Store} label="Store User Login" url={storeUrl} />
      </div>
    </div>
  );
}

function LoginLinkCard({ icon: Icon, label, url }: { icon: typeof ShieldCheck; label: string; url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        {label}
      </div>
      <p className="mb-2.5 break-all text-xs text-muted-foreground">{url}</p>
      <div className="flex gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Open Login
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
