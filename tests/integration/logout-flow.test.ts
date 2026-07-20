import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Logout must do three things that are easy to get subtly wrong:
 *
 *  1. REVOKE the session at Clerk — clearing a cookie alone leaves a captured
 *     token valid until it expires naturally.
 *  2. CLEAR the cookies so this browser stops presenting the token.
 *  3. Send no-store so the back button cannot re-render a cached signed-in page.
 *
 * These tests pin all three, plus the "revocation failure must not block
 * sign-out" behaviour.
 */

const revokeSession = vi.fn();
const authMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
  clerkClient: async () => ({ sessions: { revokeSession } }),
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
    authMock.mockResolvedValue({ sessionId: "sess_123" });
    revokeSession.mockResolvedValue(undefined);
  });

  it("revokes the session at Clerk, not just locally", async () => {
    await callSignOut();
    expect(revokeSession).toHaveBeenCalledWith("sess_123");
  });

  it("redirects to the sign-in page with the signed-out flag", async () => {
    const res = await callSignOut();
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/sign-in");
    expect(location).toContain("signed_out=1");
  });

  it("expires both Clerk cookies", async () => {
    const res = await callSignOut();
    const setCookie = res.headers.getSetCookie().join(" | ");
    expect(setCookie).toContain("__session=");
    expect(setCookie).toContain("__client_uat=");
    // Max-Age=0 is what actually removes them.
    expect(setCookie).toContain("Max-Age=0");
  });

  it("sends no-store so the back button cannot show a cached page", async () => {
    const res = await callSignOut();
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc).toContain("no-store");
    expect(cc).toContain("must-revalidate");
  });

  it("still signs the user out when Clerk revocation fails", async () => {
    revokeSession.mockRejectedValue(new Error("Clerk unreachable"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await callSignOut();

    // The cookies must still be cleared — an outage must not trap the user
    // in a signed-in state.
    expect(res.status).toBe(307);
    expect(res.headers.getSetCookie().join(" | ")).toContain("Max-Age=0");
  });

  it("does not call Clerk when there is no active session", async () => {
    authMock.mockResolvedValue({ sessionId: null });
    await callSignOut();
    expect(revokeSession).not.toHaveBeenCalled();
  });
});
