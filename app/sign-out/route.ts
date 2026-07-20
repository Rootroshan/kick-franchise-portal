import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isDevBypassEnabled } from "@/lib/devBypass";

/**
 * Sign-out endpoint. A plain navigation target so the client button needs no
 * Clerk hook — useClerk() throws during render when <ClerkProvider> isn't
 * mounted, which is the case in dev-bypass mode, and that crashed the client
 * subtree the logout button lived in.
 *
 * Three things have to happen, in this order:
 *
 *  1. REVOKE the session on Clerk's servers. Deleting the cookie alone is not
 *     logout — a token captured beforehand stays valid until it expires
 *     naturally. Only revocation invalidates it everywhere.
 *  2. CLEAR the cookies so this browser stops presenting the token.
 *  3. Send no-store headers so the browser cannot serve a cached authenticated
 *     page from the back button after the redirect.
 */
// Reads the session via auth() (which reads headers), so it can never be
// prerendered — declaring it here stops Next from attempting to at build time.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isDevBypassEnabled()) {
    try {
      const { sessionId } = await auth();
      if (sessionId) {
        const client = await clerkClient();
        await client.sessions.revokeSession(sessionId);
      }
    } catch (err) {
      // Revocation can fail if the session already expired or Clerk is
      // unreachable. Never block sign-out on it: clearing the cookies below
      // still ends the session for this browser, which is what the user asked
      // for. Logged so a persistent failure is visible.
      console.error("Sign-out: session revocation failed", err);
    }
  }

  const url = new URL("/sign-in?signed_out=1", req.url);
  const res = NextResponse.redirect(url);

  if (!isDevBypassEnabled()) {
    // Clerk stores the session in __session (plus __client_uat for the
    // client-side "is signed in" hint). Expiring both ends the session for
    // subsequent requests. Cleared on "/" so the path scope matches how they
    // were set.
    for (const name of ["__session", "__client_uat"]) {
      res.cookies.set(name, "", { maxAge: 0, path: "/", httpOnly: name === "__session", sameSite: "lax" });
    }
  }

  // Without no-store, bfcache can render the previous authenticated page when
  // the user hits Back — the session is gone, but the stale HTML still shows.
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");

  return res;
}
