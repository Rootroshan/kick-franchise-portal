"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

/**
 * OAuth landing page. Google redirects here after consent; this component
 * finishes the handshake (exchanges the code, creates the session) and then
 * forwards to the dashboard. Public — see middleware isPublicRoute — because
 * the session does not exist yet when this page loads.
 */
export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-app-bg">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Completing sign-in…</p>
      <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/admin" signUpFallbackRedirectUrl="/admin" />
    </div>
  );
}
