import { SignIn } from "@clerk/nextjs";

// Clerk catch-all sign-in route. Public (see middleware isPublicRoute).
export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg p-4">
      <SignIn />
    </div>
  );
}
