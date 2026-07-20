import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

// Public — see middleware PUBLIC_PATTERNS. No session exists when this loads.
export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
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
        <ForgotPasswordForm token={searchParams.token} />
      </main>
    </div>
  );
}
