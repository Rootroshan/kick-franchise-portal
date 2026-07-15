import { describe, it, expect } from "vitest";
import { dollarsToCents } from "../../scripts/migrate-shopify";

describe("Shopify migration: dollarsToCents", () => {
  it("converts a simple decimal string to integer cents", () => {
    expect(dollarsToCents("19.99")).toBe(1999);
    expect(dollarsToCents("18.50")).toBe(1850);
    expect(dollarsToCents("12.00")).toBe(1200);
  });

  it("handles whole-dollar amounts without a decimal", () => {
    expect(dollarsToCents("20")).toBe(2000);
  });

  it("handles single-digit cent amounts", () => {
    expect(dollarsToCents("9.5")).toBe(950);
    expect(dollarsToCents("9.05")).toBe(905);
  });

  it("handles numeric (not string) input", () => {
    expect(dollarsToCents(19.99)).toBe(1999);
  });

  it("throws on a negative price", () => {
    expect(() => dollarsToCents("-5.00")).toThrow();
  });
});
