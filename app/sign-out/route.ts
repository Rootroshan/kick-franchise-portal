import { NextResponse } from "next/server";
import { signOut } from "@/server/auth/config";
import { isDevBypassEnabled } from "@/lib/devBypass";

// Reads/writes the session cookie, so it can never be prerendered.
export const dynamic = "force-dynamic";

/**
 * Sign-out. A plain navigation target so the client button needs no hook and
 * no provider context.
 *
 * NextAuth's signOut() clears the session cookie. With the JWT strategy the
 * cookie IS the session — there is no server-side record to revoke — so once
 * it is gone the token cannot be presented again by this browser, and the
 * middleware rejects any request without it.
 *
 * The redirect additionally carries no-store so the back button cannot
 * re-render a cached authenticated page after logout.
 */
export async function GET(req: Request) {
  if (!isDevBypassEnabled()) {
    try {
      // redirect: false — we build our own response below so we can attach the
      // cache headers and the signed_out flag.
      await signOut({ redirect: false });
    } catch (err) {
      // Never block sign-out on this: the cookie clearing below is what
      // actually ends the session for this browser. Logged so a persistent
      // failure is visible.
      console.error("Sign-out: signOut() failed", err);
    }
  }

  const res = NextResponse.redirect(new URL("/sign-in?signed_out=1", req.url));

  // Belt-and-braces: expire the session cookies directly in case signOut()
  // failed above. Both the plain and __Secure- prefixed names are used
  // depending on whether the deployment is served over HTTPS.
  //
  // `secure: true` on the prefixed cookie is LOAD-BEARING, not hygiene: the
  // browser silently ignores any Set-Cookie for a __Secure-* name that lacks
  // the Secure attribute, so without it the deletion never happens and the
  // user stays signed in — logout appears to do nothing.
  res.cookies.set("authjs.session-token", "", { maxAge: 0, path: "/", httpOnly: true, sameSite: "lax" });
  res.cookies.set("__Secure-authjs.session-token", "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  });

  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");

  return res;
}
