import { describe, it, expect } from "vitest";
import { normaliseHostname, verificationRecordName, shortHostLabel } from "@/server/modules/tenants/domainNormalise";

/**
 * Stored hostnames are compared against the request Host header, which is
 * lowercase and bare. Anything that survives normalisation with a scheme, port,
 * path or different casing verifies successfully and then never routes — the
 * failure mode that made a domain read VERIFIED while serving nothing.
 */
describe("normaliseHostname", () => {
  it("lowercases and strips scheme, path, port and trailing dot", () => {
    const cases = [
      "Portal.Example.Com",
      "https://portal.example.com",
      "http://portal.example.com/",
      "https://portal.example.com/login?x=1#top",
      "portal.example.com:443",
      "portal.example.com.",
      "  portal.example.com  ",
      "https://user:pw@portal.example.com/path",
    ];

    for (const input of cases) {
      const res = normaliseHostname(input);
      expect(res.ok, `input: ${input}`).toBe(true);
      if (res.ok) expect(res.hostname, `input: ${input}`).toBe("portal.example.com");
    }
  });

  it("rejects a root domain, which would take over the apex", () => {
    const res = normaliseHostname("example.com");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/subdomain/i);
  });

  it("rejects empty and malformed input", () => {
    for (const bad of ["", "   ", "https://", "portal..example.com", "portal.exa mple.com", "-bad.example.com"]) {
      expect(normaliseHostname(bad).ok, `input: "${bad}"`).toBe(false);
    }
  });

  it("accepts deeper subdomains", () => {
    const res = normaliseHostname("shop.portal.example.co.uk");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.hostname).toBe("shop.portal.example.co.uk");
  });

  it("rejects a hostname over the DNS length limit", () => {
    const long = `${"a".repeat(60)}.${"b".repeat(60)}.${"c".repeat(60)}.${"d".repeat(60)}.example.com`;
    expect(normaliseHostname(long).ok).toBe(false);
  });

  it("derives DNS record names from the normalised hostname", () => {
    expect(verificationRecordName("portal.example.com")).toBe("_kick-verify.portal.example.com");
    // Providers that want only the subdomain label get the short form.
    expect(shortHostLabel("portal.example.com")).toBe("portal");
  });
});
