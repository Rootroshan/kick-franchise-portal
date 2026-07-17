import { SignUp } from "@clerk/nextjs";

// Clerk catch-all sign-up route. Public (see middleware isPublicRoute).
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg p-4">
      <SignUp />
    </div>
  );
}
