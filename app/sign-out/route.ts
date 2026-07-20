import { NextResponse } from "next/server";
import { isDevBypassEnabled } from "@/lib/devBypass";

/**
 * Sign-out endpoint. A plain navigation target so the client button needs no
 * Clerk hook — useClerk() throws during render when <ClerkProvider> isn't
 * mounted, which is the case in dev-bypass mode, and that crashed the client
 * subtree the logout button lived in.
 *
 * Clears Clerk's session cookies and redirects to /sign-in. Clerk's middleware
 * re-validates on the next request, so with the session cookie gone the user is
 * signed out. In dev-bypass there is no cookie to clear and we just redirect.
 */
export async function GET(req: Request) {
  const url = new URL("/sign-in", req.url);
  const res = NextResponse.redirect(url);

  if (!isDevBypassEnabled()) {
    // Clerk stores the session in __session (plus __client_uat for the
    // client-side "is signed in" hint). Expiring both ends the session for
    // subsequent requests.
    for (const name of ["__session", "__client_uat"]) {
      res.cookies.set(name, "", { maxAge: 0, path: "/" });
    }
  }

  return res;
}
