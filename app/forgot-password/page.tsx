"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { Loader2, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";

/**
 * Password reset. Two steps, both handled by Clerk:
 *   1. Request a reset code, emailed to the address.
 *   2. Submit the code plus a new password.
 *
 * Step 1 always reports success regardless of whether the address exists —
 * "no account found" would let anyone test which emails are registered.
 */
export default function ForgotPasswordPage() {
  const { signIn, setActive, isLoaded } = useSignIn();

  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (!isLoaded || !signIn) return setError("Still loading — try again in a moment.");

    setPending(true);
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: email.trim() });
      setStep("reset");
    } catch (err) {
      const code = (err as { errors?: Array<{ code?: string }> } | null)?.errors?.[0]?.code;
      if (code === "form_identifier_not_found") {
        // Advance anyway: revealing that the address is unregistered is an
        // enumeration vector. The code simply never arrives.
        setStep("reset");
      } else if (code === "too_many_requests") {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError("Could not send the reset code. Please try again.");
      }
    } finally {
      setPending(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) return setError("Enter the code from your email.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (!isLoaded || !signIn) return setError("Still loading — try again in a moment.");

    setPending(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code.trim(),
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        window.location.href = "/admin";
        return;
      }
      setError("Additional verification is required to finish resetting your password.");
    } catch (err) {
      const errCode = (err as { errors?: Array<{ code?: string }> } | null)?.errors?.[0]?.code;
      if (errCode === "form_code_incorrect" || errCode === "verification_failed") {
        setError("That code is incorrect or has expired.");
      } else if (errCode === "form_password_pwned") {
        setError("That password has appeared in a data breach. Choose a different one.");
      } else if (errCode === "form_password_length_too_short") {
        setError("Password must be at least 8 characters.");
      } else {
        setError("Could not reset your password. Please try again.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-app-bg">
      <header className="flex items-center px-4 py-5 sm:px-8">
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-active text-sm font-black text-sidebar-active-foreground">
            K
          </span>
          <span className="text-sm font-bold">KICK</span>
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[420px] rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            {step === "request" ? "Reset your password" : "Check your email"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "request"
              ? "We'll email you a code to reset your password."
              : `If an account exists for ${email}, a reset code is on its way.`}
          </p>

          <form onSubmit={step === "request" ? requestCode : resetPassword} noValidate className="mt-6">
            {step === "request" ? (
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
            ) : (
              <>
                <label htmlFor="code" className="text-sm font-medium">
                  Reset code
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={pending}
                  className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-muted/40 px-3 text-sm disabled:opacity-60"
                />

                <label htmlFor="new-password" className="mt-4 block text-sm font-medium">
                  New password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="new-password"
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
              </>
            )}

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
              disabled={pending}
              className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-status-info text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === "request" ? "Send reset code" : "Set new password"}
            </button>
          </form>

          <a
            href="/sign-in"
            className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </a>
        </div>
      </main>
    </div>
  );
}
