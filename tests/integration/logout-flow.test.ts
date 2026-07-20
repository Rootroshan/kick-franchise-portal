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

  it("redirects to the sign-in page with the signed-out flag", async () => {
    const res = await callSignOut();
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/sign-in");
    expect(location).toContain("signed_out=1");
  });

  it("expires the session cookie", async () => {
    const res = await callSignOut();
    const setCookie = res.headers.getSetCookie().join(" | ");
    expect(setCookie).toContain("authjs.session-token=");
    // Max-Age=0 is what actually removes it.
    expect(setCookie).toContain("Max-Age=0");
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
