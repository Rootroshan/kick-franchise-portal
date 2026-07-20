"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Loader2, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { testConnectionAction } from "@/app/admin/settings/actions";
import type { TestResult } from "@/server/modules/dashboard/connectionTest";
import { cn } from "@/lib/utils";

export type SetupStep = { title: string; body: string; link?: { label: string; href: string } };

/**
 * Guided setup for an externally-configured integration.
 *
 * Deliberately has no field for entering the secret. Keys stay in the hosting
 * platform's encrypted env store; this panel only tells the admin which vars to
 * set, where to get the values, and whether the result works. Storing them in
 * the database would place a payment credential in every backup and make any
 * KICK_ADMIN able to redirect payouts.
 */
export function IntegrationSetup({
  service,
  title,
  envVars,
  steps,
  configured,
}: {
  service: "stripe" | "r2";
  title: string;
  envVars: string[];
  steps: SetupStep[];
  configured: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [pending, startTransition] = useTransition();

  const runTest = () => {
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await testConnectionAction(service));
      } catch {
        setResult({ ok: false, message: "Could not run the test. Check the server logs and retry." });
      }
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium">
          {title} setup
          {!configured && <span className="ml-2 text-xs font-normal text-muted-foreground">— not configured</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <ol className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                  {s.link && (
                    <a
                      href={s.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-status-info hover:underline"
                    >
                      {s.link.label}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Environment variables to set</p>
            <div className="flex flex-col gap-1.5">
              {envVars.map((v) => (
                <CopyRow key={v} value={v} />
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={runTest}
              disabled={pending}
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {pending ? "Testing…" : "Test connection"}
            </button>
            <span className="text-xs text-muted-foreground">Changes apply after the next deploy.</span>
          </div>

          {result && (
            <div
              className={cn(
                "mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                result.ok ? "bg-status-success/10 text-status-success" : "bg-status-error/10 text-status-error"
              )}
              role="status"
            >
              {result.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div>
                <p className="font-medium">{result.message}</p>
                {result.detail && <p className="mt-0.5 opacity-80">{result.detail}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure origin / denied permission) — the value is
      // visible on screen, so selecting it manually still works.
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5">
      <code className="truncate font-mono text-xs">{value}</code>
      <button
        onClick={copy}
        className="shrink-0 rounded p-1 hover:bg-background"
        aria-label={`Copy ${value}`}
        title="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
