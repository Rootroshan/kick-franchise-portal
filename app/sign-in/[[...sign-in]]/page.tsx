import { SignIn } from "@clerk/nextjs";
import { CheckCircle2 } from "lucide-react";

// Clerk catch-all sign-in route. Public (see middleware isPublicRoute).
export default function SignInPage({
  searchParams,
}: {
  searchParams: { signed_out?: string };
}) {
  // Set by /sign-out after the session is revoked and the cookies are cleared.
  const signedOut = searchParams.signed_out === "1";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app-bg p-4">
      {signedOut && (
        <div
          role="status"
          className="flex w-full max-w-sm items-center gap-2 rounded-lg bg-status-success/10 px-3 py-2.5 text-sm font-medium text-status-success"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Logged out successfully
        </div>
      )}
      <SignIn />
    </div>
  );
}
