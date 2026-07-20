import { Lock, BarChart3, Users } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { KickWordmark } from "@/components/auth/KickWordmark";
import { LanguageSelector } from "@/components/auth/LanguageSelector";

// Catch-all so any /sign-in/* path resolves here rather than 404ing.
// Public — see middleware PUBLIC_PATTERNS.
export default function SignInPage({
  searchParams,
}: {
  searchParams: { signed_out?: string; callbackUrl?: string; error?: string };
}) {
  const signedOut = searchParams.signed_out === "1";
  // Set by the middleware when it bounces an unauthenticated request, so the
  // user lands back where they were headed after signing in.
  const callbackUrl = safeCallback(searchParams.callbackUrl);

  return (
    <div className="relative min-h-screen overflow-hidden bg-app-bg">
      {/* Decorative diagonal bands, matching the reference. aria-hidden +
          pointer-events-none: pure decoration, never in the way. Rotated divs
          rather than an image so they scale to any viewport with no asset. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[30%] -top-[45%] h-[90%] w-[85%] rotate-[24deg] bg-white/60 shadow-sm" />
        <div className="absolute -left-[42%] -top-[30%] h-[85%] w-[80%] rotate-[24deg] bg-black/[0.03]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1400px] flex-col lg:flex-row">
        {/* Marketing panel — desktop only. Removed from the DOM on small
            screens rather than visually hidden, so screen readers reach the
            form immediately and mobile pays no markup cost. */}
        <aside className="hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-center lg:gap-10 lg:px-14 xl:px-20">
          <KickWordmark />

          <div>
            <h1 className="text-4xl font-bold tracking-tight">Welcome Back 👋</h1>
            <p className="mt-3 max-w-sm text-base text-muted-foreground">
              Sign in to access your super admin dashboard and manage everything.
            </p>
          </div>

          <ul className="flex flex-col gap-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
                  <f.Icon className="h-5 w-5 text-status-info" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{f.title}</span>
                  <span className="mt-0.5 block max-w-xs text-sm text-muted-foreground">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <main className="flex flex-1 flex-col lg:w-1/2">
          <div className="flex justify-end px-4 py-5 sm:px-8">
            <LanguageSelector />
          </div>

          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-10 sm:px-8">
            {/* Compact mark for small screens, where the left panel is absent. */}
            <div className="mb-8 lg:hidden">
              <KickWordmark />
            </div>

            <LoginForm signedOut={signedOut} callbackUrl={callbackUrl} authError={searchParams.error} />

            <p className="mt-8 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} KICK Media Group. All rights reserved.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

const FEATURES = [
  { Icon: Lock, title: "Secure Access", body: "Your data is protected with enterprise-grade security." },
  { Icon: BarChart3, title: "Real-time Insights", body: "Track performance and make smarter decisions." },
  { Icon: Users, title: "Complete Control", body: "Manage brands, stores, users and operations seamlessly." },
] as const;

/**
 * Only same-origin relative paths are accepted as a post-login destination.
 * An absolute URL here would turn the login page into an open redirect —
 * ?callbackUrl=https://evil.example lands the user off-site after signing in.
 */
function safeCallback(raw: string | undefined): string {
  if (!raw) return "/admin";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/admin";
  return raw;
}
