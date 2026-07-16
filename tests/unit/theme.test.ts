import { describe, it, expect } from "vitest";
import { parseTenantTheme } from "@/lib/theme";

describe("parseTenantTheme", () => {
  it("does not throw for a tenant with no theme set (default {})", () => {
    expect(() => parseTenantTheme({})).not.toThrow();
    const theme = parseTenantTheme({});
    expect(theme.logoUrl).toBe("");
  });

  it("does not throw for null/undefined input", () => {
    expect(() => parseTenantTheme(null)).not.toThrow();
    expect(() => parseTenantTheme(undefined)).not.toThrow();
  });

  it("accepts a real logo URL", () => {
    const theme = parseTenantTheme({ logoUrl: "https://example.com/logo.png" });
    expect(theme.logoUrl).toBe("https://example.com/logo.png");
  });
});
