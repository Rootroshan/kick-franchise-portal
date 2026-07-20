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

  // Return the user to the login page on THEIR host. Building this from
  // req.url would use the canonical deployment URL on Vercel, ejecting a tenant
  // user off their own portal on the way out.
  const host = req.headers.get("host") ?? new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const base = (process.env.APP_BASE_DOMAIN ?? "").toLowerCase();
  const bare = host.split(":")[0]?.toLowerCase() ?? "";
  const isPlatformHost = !base || bare === base || bare.endsWith(".vercel.app") || bare === "localhost";

  // Tenant portals return to their own ROOT — the middleware rewrites that to
  // the branded login, so the user never sees an internal path. Only the
  // platform host uses an explicit /sign-in.
  const res = NextResponse.redirect(
    new URL(`${isPlatformHost ? "/sign-in" : "/"}?signed_out=1`, `${proto}://${host}`)
  );

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
