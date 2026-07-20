"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Loader2, CheckCircle2, XCircle, ExternalLink, Trash2 } from "lucide-react";
import { testConnectionAction, saveSettingsAction, clearSettingAction } from "@/app/admin/settings/actions";
import type { TestResult } from "@/server/modules/dashboard/connectionTest";
import type { SettingStatus } from "@/server/modules/settings/platformSettings";
import { cn } from "@/lib/utils";

export type SetupField = { key: string; label: string; hint?: string; secret: boolean };

/**
 * Credential entry for an external integration.
 *
 * Inputs are write-only: a stored secret is shown as "••••4242" and its value is
 * never sent to the browser. Leaving a field blank keeps the existing value, so
 * an admin can update one key without re-entering the others.
 */
export function IntegrationSetup({
  service,
  title,
  docsHref,
  docsLabel,
  fields,
  statuses,
}: {
  service: "stripe" | "r2";
  title: string;
  docsHref: string;
  docsLabel: string;
  fields: SetupField[];
  statuses: SettingStatus[];
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [test, setTest] = useState<TestResult | null>(null);
  const [save, setSave] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const statusOf = (key: string) => statuses.find((s) => s.key === key);
  const configured = fields.some((f) => statusOf(f.key)?.configured);

  const runSave = () => {
    setSave(null);
    setTest(null);
    startTransition(async () => {
      const res = await saveSettingsAction(values);
      setSave(res);
      if (res.ok) setValues({}); // clear inputs so secrets don't linger in the DOM
    });
  };

  const runTest = () => {
    setTest(null);
    startTransition(async () => {
      try {
        setTest(await testConnectionAction(service));
      } catch {
        setTest({ ok: false, message: "Could not run the test. Check the server logs and retry." });
      }
    });
  };

  const runClear = (key: string) => {
    startTransition(async () => {
      setSave(await clearSettingAction(key));
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
          {title}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {configured ? "— configured" : "— not configured"}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <a
            href={docsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-status-info hover:underline"
          >
            {docsLabel}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <div className="flex flex-col gap-3">
            {fields.map((f) => {
              const status = statusOf(f.key);
              return (
                <div key={f.key}>
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={f.key} className="text-sm font-medium">
                      {f.label}
                    </label>
                    {status?.configured && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-mono">{status.display}</span>
                        {status.source === "database" && (
                          <button
                            onClick={() => runClear(f.key)}
                            disabled={pending}
                            className="rounded p-0.5 hover:bg-muted disabled:opacity-50"
                            aria-label={`Remove ${f.label}`}
                            title="Remove stored value"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                  <input
                    id={f.key}
                    type={f.secret ? "password" : "text"}
                    autoComplete="off"
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={status?.configured ? "Leave blank to keep current value" : f.hint || ""}
                    className="mt-1 min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  />
                  {status?.source === "environment" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Currently set from the environment. Saving here overrides it.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={runSave}
              disabled={pending}
              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </button>
            <button
              onClick={runTest}
              disabled={pending}
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              Test connection
            </button>
          </div>

          {save && <Banner ok={save.ok} message={save.message} />}
          {test && <Banner ok={test.ok} message={test.message} detail={test.detail} />}
        </div>
      )}
    </div>
  );
}

function Banner({ ok, message, detail }: { ok: boolean; message: string; detail?: string }) {
  return (
    <div
      className={cn(
        "mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
        ok ? "bg-status-success/10 text-status-success" : "bg-status-error/10 text-status-error"
      )}
      role="status"
    >
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>
        <p className="font-medium">{message}</p>
        {detail && <p className="mt-0.5 opacity-80">{detail}</p>}
      </div>
    </div>
  );
}
