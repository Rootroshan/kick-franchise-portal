"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { checkRoleLoginAction } from "@/app/sign-in/actions";
import type { PortalRole } from "@/server/auth/loginValidation";

/**
 * Brand portal sign-in, locked to one role.
 *
 * `role` is a prop set by the server page for its own fixed route — never a
 * user choice. Two steps on submit, same as the old combined login:
 *  1. checkRoleLoginAction verifies the credentials AND that this user holds
 *     `role` on this tenant, so a mismatch renders inline ("wrong door").
 *  2. Only then does NextAuth issue a session.
 *
 * The destination comes back from the server (derived from the verified
 * Membership role) — the client never chooses where it lands.
 */
export function RoleLoginForm({
  role,
  heading,
  description,
  brandName,
}: {
  role: PortalRole;
  heading: string;
  description: string;
  brandName: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) return setError("Enter your email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");

    setPending(true);
    try {
      const check = await checkRoleLoginAction({ email: email.trim(), password, role });
      if (!check.ok) {
        setError(check.message);
        setPending(false);
        return;
      }

      const res = await signIn("credentials", { email: email.trim(), password, redirect: false });
      if (res?.error) {
        setError("Incorrect email or password for this portal.");
        setPending(false);
        return;
      }

      // Full navigation so the session cookie is present on the server request
      // that renders the destination. `pending` stays true while it happens.
      window.location.href = check.redirectTo;
    } catch {
      setError("Could not sign in. Please try again.");
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-[460px] rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-9">
      <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">{description}</p>

      <form onSubmit={submit} noValidate>
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          className="mt-1.5 min-h-12 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
        />

        <label htmlFor="password" className="mt-4 block text-sm font-medium">
          Password
        </label>
        <div className="relative mt-1.5">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
            className="min-h-12 w-full rounded-lg border border-border bg-background pl-3 pr-12 text-sm disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="remember" className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              id="remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={pending}
              className="h-4 w-4 rounded border-border"
              style={{ accentColor: "var(--tenant-primary, #2563eb)" }}
            />
            Remember me
          </label>
          <a
            href={role === "FRANCHISOR_ADMIN" ? "/forgot-password?login=admin" : "/forgot-password?login=store"}
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--tenant-primary, #2563eb)" }}
          >
            Forgot your password?
          </a>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-lg bg-status-error/10 px-3 py-2.5 text-sm text-status-error"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          style={{ backgroundColor: "var(--tenant-primary, #2563eb)" }}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="sr-only">{brandName}</p>
    </div>
  );
}
