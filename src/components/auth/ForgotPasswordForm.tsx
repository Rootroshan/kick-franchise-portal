"use client";

import { useState } from "react";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { requestResetAction, resetPasswordAction } from "@/app/forgot-password/actions";

/**
 * Password reset, two modes decided by the presence of a token in the URL:
 *   - no token  → ask for the email, send a reset link
 *   - token     → collect the new password and consume the token
 */
export function ForgotPasswordForm({ token }: { token?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  const isReset = Boolean(token);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (isReset && password !== confirm) {
      return setResult({ ok: false, message: "Passwords do not match." });
    }

    setPending(true);
    try {
      setResult(isReset ? await resetPasswordAction(token!, password) : await requestResetAction(email));
    } catch {
      setResult({ ok: false, message: "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  };

  // After a successful reset there is nothing more to do here — point the user
  // at sign-in rather than leaving a consumed form on screen.
  const done = isReset && result?.ok;

  return (
    <div className="w-full max-w-[420px] rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isReset ? "Set a new password" : "Reset your password"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isReset
          ? "Choose a new password for your account."
          : "We'll email you a link to reset your password."}
      </p>

      {!done && (
        <form onSubmit={submit} noValidate className="mt-6">
          {isReset ? (
            <>
              <label htmlFor="password" className="text-sm font-medium">
                New password
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
            </>
          ) : (
            <>
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-muted/40 px-3 text-sm disabled:opacity-60"
              />
            </>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-status-info text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isReset ? "Update password" : "Send reset link"}
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
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{result.message}</span>
        </div>
      )}

      <a
        href="/sign-in"
        className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </a>
    </div>
  );
}
