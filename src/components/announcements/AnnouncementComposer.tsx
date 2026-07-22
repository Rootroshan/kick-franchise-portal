"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Lightbulb,
  Loader2,
  Pencil,
  Pin,
  Rocket,
  Save,
  Send,
  ShieldCheck,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/kit";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

type PublishMode = "NOW" | "SCHEDULE";
type Intent = "SAVE_DRAFT" | "PUBLISH";

const fmt = (v: string) =>
  v
    ? new Date(v).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

function PendingOverlay({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return pending ? <LoadingOverlay message={label} /> : null;
}

function SubmitButtons({ mode, onIntent }: { mode: PublishMode; onIntent: (i: Intent) => void }) {
  const { pending } = useFormStatus();
  const primaryLabel = mode === "NOW" ? "Publish Announcement" : "Schedule Announcement";
  return (
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="submit"
        name="intent"
        value="SAVE_DRAFT"
        disabled={pending}
        onClick={() => onIntent("SAVE_DRAFT")}
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        <Save className="h-4 w-4" aria-hidden="true" /> Save Draft
      </button>
      <button
        type="submit"
        name="intent"
        value="PUBLISH"
        disabled={pending}
        onClick={() => onIntent("PUBLISH")}
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        {primaryLabel}
      </button>
    </div>
  );
}

/**
 * Create Announcement composer per the approved design: main form card +
 * right rail (Publish Options, live Announcement Summary, Tips). Shared by
 * KICK_ADMIN (brands passed, selector shown) and FRANCHISOR_ADMIN (brandName
 * fixed — tenant resolved server-side, never taken from this form).
 */
export function AnnouncementComposer({
  action,
  backHref,
  title: pageTitle,
  description,
  brands,
  brandName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  backHref: string;
  title: string;
  description: string;
  /** KICK_ADMIN only: selectable brands. */
  brands?: Array<{ id: string; name: string }>;
  /** FRANCHISOR_ADMIN only: the resolved brand, display-only. */
  brandName?: string;
}) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<PublishMode>("NOW");
  const [publishAt, setPublishAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [requiresAck, setRequiresAck] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [intent, setIntent] = useState<Intent>("PUBLISH");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [tz, setTz] = useState("");

  const dirty = !!(title || body || publishAt || expiresAt || isPinned || requiresAck || tenantId);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const selectedBrandName = brandName ?? brands?.find((b) => b.id === tenantId)?.name ?? "";
  const previewStatus = title.trim() && body.trim() ? (mode === "NOW" ? "PUBLISHED" : "SCHEDULED") : "DRAFT";

  const overlayLabel =
    intent === "SAVE_DRAFT" ? "Saving draft…" : mode === "NOW" ? "Publishing announcement…" : "Scheduling announcement…";

  const validate = (submitIntent: Intent): boolean => {
    const next: Record<string, string> = {};
    if (brands && !tenantId) next.tenantId = "Pick a brand";
    if (title.trim().length < 3) next.title = "Title must be at least 3 characters";
    if (!body.trim()) next.body = "Body is required";
    if (submitIntent === "PUBLISH" && mode === "SCHEDULE") {
      if (!publishAt) next.publishAt = "A publish date is required when scheduling";
      else if (new Date(publishAt) <= new Date()) next.publishAt = "Scheduled publish time must be in the future";
    }
    if (expiresAt) {
      const effectivePublish = mode === "SCHEDULE" && publishAt ? new Date(publishAt) : new Date();
      if (new Date(expiresAt) <= effectivePublish) next.expiresAt = "Expiry must be after the publish time";
    }
    setErrors(next);
    if (Object.keys(next).length) toast.error(Object.values(next)[0]!);
    return Object.keys(next).length === 0;
  };

  const inputCls = (key: string) =>
    cn(
      "h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring",
      errors[key] ? "border-status-error" : "border-input"
    );

  return (
    <>
      <button
        type="button"
        onClick={() => (dirty ? setConfirmLeave(true) : router.push(backHref))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-status-info hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Announcements
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <form
        action={action}
        onSubmit={(e) => {
          const clicked = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value as Intent | undefined;
          if (!validate(clicked ?? intent)) e.preventDefault();
        }}
        className="grid min-w-0 items-start gap-6 xl:grid-cols-3"
      >
        <PendingOverlay label={overlayLabel} />
        <input type="hidden" name="publishMode" value={mode} />

        {/* ── Main form card ── */}
        <section className="flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-card p-6 xl:col-span-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Announcement Details
          </h2>

          {brands ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tenantId" className="text-sm font-medium">
                Brand<span className="text-status-error"> *</span>
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <select
                  id="tenantId"
                  name="tenantId"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  aria-invalid={!!errors.tenantId}
                  aria-describedby={errors.tenantId ? "tenantId-error" : undefined}
                  className={inputCls("tenantId")}
                >
                  <option value="">Select a brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.tenantId && (
                <p id="tenantId-error" className="text-xs text-status-error">
                  {errors.tenantId}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">{brandName}</span>
              <span className="text-xs text-muted-foreground">— your brand</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="title" className="text-sm font-medium">
              Title<span className="text-status-error"> *</span>
            </label>
            <div className="relative">
              <Type className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id="title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
                placeholder="Enter announcement title"
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? "title-error" : undefined}
                className={inputCls("title")}
              />
            </div>
            {errors.title && (
              <p id="title-error" className="text-xs text-status-error">
                {errors.title}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="body" className="text-sm font-medium">
              Body<span className="text-status-error"> *</span>
            </label>
            <div className="relative">
              <Pencil className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <textarea
                id="body"
                name="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                maxLength={20_000}
                placeholder="Write your announcement…"
                aria-invalid={!!errors.body}
                aria-describedby={errors.body ? "body-error" : undefined}
                className={cn(
                  "w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring",
                  errors.body ? "border-status-error" : "border-input"
                )}
              />
            </div>
            {errors.body && (
              <p id="body-error" className="text-xs text-status-error">
                {errors.body}
              </p>
            )}
          </div>

          {/* ── Schedule ── */}
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Schedule
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {mode === "SCHEDULE" && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="publishAt" className="text-sm font-medium">
                    Publish at<span className="text-status-error"> *</span>
                  </label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input
                      id="publishAt"
                      name="publishAt"
                      type="datetime-local"
                      value={publishAt}
                      onChange={(e) => setPublishAt(e.target.value)}
                      aria-invalid={!!errors.publishAt}
                      aria-describedby="publishAt-help"
                      className={inputCls("publishAt")}
                    />
                  </div>
                  <p id="publishAt-help" className="text-xs text-muted-foreground">
                    Announcement will be visible from this time{tz ? ` (${tz})` : ""}.
                  </p>
                  {errors.publishAt && <p className="text-xs text-status-error">{errors.publishAt}</p>}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="expiresAt" className="text-sm font-medium">
                  Expires at (optional)
                </label>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input
                    id="expiresAt"
                    name="expiresAt"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    aria-invalid={!!errors.expiresAt}
                    aria-describedby="expiresAt-help"
                    className={inputCls("expiresAt")}
                  />
                </div>
                <p id="expiresAt-help" className="text-xs text-muted-foreground">
                  Announcement will be hidden after this time.
                </p>
                {errors.expiresAt && <p className="text-xs text-status-error">{errors.expiresAt}</p>}
              </div>
            </div>
          </div>

          {/* ── Settings ── */}
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3.5 hover:bg-muted/40">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-status-info/10 text-status-info">
              <Pin className="h-4 w-4" aria-hidden="true" />
            </span>
            <input type="checkbox" name="isPinned" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="h-4 w-4 rounded border-input" />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">Pin to top of store feed</span>
              <span className="text-xs text-muted-foreground">Keep this announcement at the top of the store feed until it expires.</span>
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3.5 hover:bg-muted/40">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-status-info/10 text-status-info">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <input type="checkbox" name="requiresAck" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} className="h-4 w-4 rounded border-input" />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">Require acknowledgement from stores</span>
              <span className="text-xs text-muted-foreground">Store users must acknowledge this announcement before continuing.</span>
            </span>
          </label>

          <SubmitButtons mode={mode} onIntent={setIntent} />
        </section>

        {/* ── Right rail ── */}
        <aside className="flex min-w-0 flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Rocket className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Publish Options
            </h2>
            <div className="flex flex-col gap-2">
              {(
                [
                  { value: "NOW", label: "Publish Now", desc: "Make this announcement live immediately.", Icon: Rocket },
                  { value: "SCHEDULE", label: "Schedule for Later", desc: "Choose a future date and time to publish.", Icon: Clock },
                ] as const
              ).map(({ value, label, desc, Icon }) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                    mode === value ? "border-status-info/50 bg-status-info/5" : "border-border hover:bg-muted/40"
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </span>
                  <input
                    type="radio"
                    name="publishModeChoice"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Announcement Summary
            </h2>
            <dl className="flex flex-col gap-2 text-xs">
              {(
                [
                  ["Brand", selectedBrandName || "—"],
                  ["Title", title.trim() || "—"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="max-w-[60%] truncate font-medium">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={previewStatus} />
                </dd>
              </div>
              {(
                [
                  ["Publish", mode === "NOW" ? "Immediately" : fmt(publishAt)],
                  ["Expires", fmt(expiresAt)],
                  ["Pinned", isPinned ? "Yes" : "No"],
                  ["Acknowledgement", requiresAck ? "Required" : "No"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="max-w-[60%] truncate font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Lightbulb className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Tips
            </h2>
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              {[
                "Keep your title short and clear.",
                "Provide all the details stores need to know.",
                "Use acknowledgement for important updates.",
                "Add an expiry date for temporary notices.",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success" aria-hidden="true" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </form>

      {/* ── Discard confirmation ── */}
      {confirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="mb-1 text-base font-semibold">Discard announcement?</h3>
            <p className="mb-4 text-sm text-muted-foreground">Your unsaved announcement content will be lost.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmLeave(false)}
                className="min-h-10 flex-1 rounded-md border border-border text-sm font-medium hover:bg-muted"
              >
                Continue Editing
              </button>
              <button
                onClick={() => router.push(backHref)}
                className="min-h-10 flex-1 rounded-md bg-status-error text-sm font-semibold text-white hover:opacity-95"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
