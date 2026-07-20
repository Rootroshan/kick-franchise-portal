import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Logout must:
 *   1. Clear the NextAuth session cookie — with the JWT strategy the cookie IS
 *      the session, so removing it ends the session for this browser.
 *   2. Redirect to sign-in with the signed-out flag.
 *   3. Send no-store so the back button cannot re-render a cached signed-in page.
 *
 * A signOut() failure must never block any of that.
 */

const signOutMock = vi.fn();

vi.mock("@/server/auth/config", () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

vi.mock("@/lib/devBypass", () => ({ isDevBypassEnabled: () => false }));

async function callSignOut() {
  const { GET } = await import("@/app/sign-out/route");
  return GET(new Request("https://portal.example.com/sign-out"));
}

describe("Sign-out flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    signOutMock.mockResolvedValue(undefined);
  });

  it("calls NextAuth signOut", async () => {
    await callSignOut();
    expect(signOutMock).toHaveBeenCalled();
  });

  it("returns a tenant user to the branded login on their OWN host", async () => {
    // Building the redirect from req.url would use the canonical deployment
    // URL on Vercel and eject the user onto *.vercel.app mid sign-out.
    const res = await callSignOut();
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("portal.example.com");
    expect(location).toContain("/portal-login");
    expect(location).toContain("signed_out=1");
  });

  it("returns a platform user to the KICK admin login", async () => {
    const { GET } = await import("@/app/sign-out/route");
    const res = await GET(new Request("https://kick-franchise-portal.vercel.app/sign-out"));
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/sign-in");
    expect(location).not.toContain("/portal-login");
  });

  it("expires the session cookie", async () => {
    const res = await callSignOut();
    const setCookie = res.headers.getSetCookie().join(" | ");
    expect(setCookie).toContain("authjs.session-token=");
    // Max-Age=0 is what actually removes it.
    expect(setCookie).toContain("Max-Age=0");
  });

  it("clears the __Secure- cookie WITH the Secure attribute", async () => {
    // Browsers silently ignore a Set-Cookie for a __Secure-* name that lacks
    // the Secure attribute — without it the deletion never happens on HTTPS
    // and logout appears to do nothing. This is the production cookie name,
    // so this assertion is what actually guards logout in prod.
    const res = await callSignOut();
    const secureCookie = res.headers.getSetCookie().find((c) => c.startsWith("__Secure-authjs.session-token="));
    expect(secureCookie).toBeDefined();
    expect(secureCookie).toMatch(/Secure/i);
    expect(secureCookie).toContain("Max-Age=0");
  });

  it("sends no-store so the back button cannot show a cached page", async () => {
    const res = await callSignOut();
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc).toContain("no-store");
    expect(cc).toContain("must-revalidate");
  });

  it("still clears cookies when signOut() throws", async () => {
    signOutMock.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await callSignOut();

    expect(res.status).toBe(307);
    expect(res.headers.getSetCookie().join(" | ")).toContain("Max-Age=0");
  });
});
