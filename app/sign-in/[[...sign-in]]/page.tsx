import { CheckCircle2 } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";

// Catch-all so any /sign-in/* path resolves here rather than 404ing.
// Public — see middleware PUBLIC_PATTERNS.
export default function SignInPage({
  searchParams,
}: {
  searchParams: { signed_out?: string };
}) {
  // Set by /sign-out after the session is revoked and the cookies are cleared.
  const signedOut = searchParams.signed_out === "1";

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

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-16">
        {signedOut && (
          <div
            role="status"
            className="flex w-full max-w-[420px] items-center gap-2 rounded-lg bg-status-success/10 px-3 py-2.5 text-sm font-medium text-status-success"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Logged out successfully
          </div>
        )}
        <LoginForm />
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} KICK Franchise Portal
      </footer>
    </div>
  );
}
