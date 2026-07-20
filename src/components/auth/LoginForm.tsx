"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

/**
 * Sign-in form (NextAuth credentials + Google).
 *
 * Credential failures collapse to a single message: distinguishing "no such
 * account" from "wrong password" would let anyone test which addresses are
 * registered. The server side mirrors this by returning null for every failure
 * mode (see server/auth/config.ts).
 */
export function LoginForm({ callbackUrl = "/admin" }: { callbackUrl?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) return setError("Enter your email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");

    setPending(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Incorrect email or password.");
        return;
      }

      // Full navigation, not router.push: the session cookie must be present on
      // the server request that renders the dashboard, and a client-side
      // transition can race the cookie being set.
      window.location.href = callbackUrl;
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    setGooglePending(true);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setGooglePending(false);
      setError("Could not start Google sign-in. Please try again.");
    }
  };

  const busy = pending || googlePending;

  return (
    <div className="w-full max-w-[420px] rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to KICK</h1>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="mt-6 flex min-h-11 w-full items-center justify-center gap-2.5 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        {googlePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
        Google
      </button>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} noValidate>
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-muted/40 px-3 text-sm disabled:opacity-60"
        />

        <label htmlFor="password" className="mt-4 block text-sm font-medium">
          Password
        </label>
        <div className="relative mt-1.5">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            className="min-h-11 w-full rounded-md border border-border bg-muted/40 pl-3 pr-11 text-sm disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg bg-status-error/10 px-3 py-2 text-sm text-status-error"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-status-info text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Forgot your{" "}
        <a href="/forgot-password" className="font-medium text-status-info underline underline-offset-2">
          password
        </a>
        ?
      </p>
    </div>
  );
}

/** Google's mark, inline so the page has no external asset dependency. */
function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z"
      />
    </svg>
  );
}
