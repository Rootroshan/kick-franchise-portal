import { describe, it, expect } from "vitest";
import { portalLoginUrls } from "@/server/modules/tenants/loginUrls";

/**
 * Login URLs are derived from the domain, never stored — this pins that a
 * hostname change needs no follow-up write anywhere, since these are always
 * computed fresh from whatever hostname is passed in.
 */
describe("portalLoginUrls", () => {
  it("builds distinct admin and store login URLs from a hostname", () => {
    const { adminLoginUrl, storeLoginUrl } = portalLoginUrls("portal.voltstudios.ca");
    expect(adminLoginUrl).toBe("https://portal.voltstudios.ca/admin-login");
    expect(storeLoginUrl).toBe("https://portal.voltstudios.ca/store-login");
  });

  it("reflects a different domain automatically, with no persisted state", () => {
    const first = portalLoginUrls("portal.brand-a.com");
    const second = portalLoginUrls("portal.brand-b.com");
    expect(first.adminLoginUrl).not.toBe(second.adminLoginUrl);
    expect(second.adminLoginUrl).toBe("https://portal.brand-b.com/admin-login");
    expect(second.storeLoginUrl).toBe("https://portal.brand-b.com/store-login");
  });
});
