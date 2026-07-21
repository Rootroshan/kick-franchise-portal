"use client";

import { useState } from "react";
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { acceptInvitationAction } from "@/app/accept-invite/actions";

/** Accept an invitation: set a password to create the account. Single mode, unlike forgot-password's two — there is no "request" step here, the invite email already carries the token. */
export function AcceptInviteForm({ token }: { token?: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; loginPath?: string } | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (password !== confirm) {
      return setResult({ ok: false, message: "Passwords do not match." });
    }

    setPending(true);
    try {
      setResult(await acceptInvitationAction(token ?? "", password));
    } catch {
      setResult({ ok: false, message: "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full max-w-[420px] rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Invalid invitation link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link is missing its invitation token. Check the link in your email, or ask whoever invited you to
          resend it.
        </p>
      </div>
    );
  }

  const done = result?.ok;

  return (
    <div className="w-full max-w-[420px] rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Accept your invitation</h1>
      <p className="mt-2 text-sm text-muted-foreground">Set a password to create your account.</p>

      {!done && (
        <form onSubmit={submit} noValidate className="mt-6">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              className="min-h-11 w-full rounded-md border border-border bg-muted/40 pl-3 pr-11 text-sm disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <label htmlFor="confirm" className="mt-4 block text-sm font-medium">
            Confirm password
          </label>
          <input
            id="confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={pending}
            className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-muted/40 px-3 text-sm disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={pending}
            className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-status-info text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </button>
        </form>
      )}

      {result && (
        <div
          role="status"
          className={`mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            result.ok ? "bg-status-success/10 text-status-success" : "bg-status-error/10 text-status-error"
          }`}
        >
          {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{result.message}</span>
        </div>
      )}

      {done && (
        <a
          href={result?.loginPath ?? "/sign-in"}
          className="mt-5 flex min-h-11 w-full items-center justify-center rounded-md border border-border text-sm font-semibold hover:bg-muted"
        >
          Go to sign in
        </a>
      )}
    </div>
  );
}
