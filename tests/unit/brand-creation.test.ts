import { describe, expect, it } from "vitest";
import { createBrandSchema, portalDomainInputSchema } from "@/server/modules/tenants/schemas";

const validPayload = {
  brandName: "  Acme Burgers  ",
  status: "draft",
  portalDomain: "https://PORTAL.AcmeBurgers.com/path?x=1",
  branding: { primary: "#2563EB", secondary: "#0F1C35", font: "Inter" },
  admin: { sendInvitation: true, firstName: "Ada", lastName: "Lovelace", email: "ADA@EXAMPLE.COM" },
  confirmation: true,
  idempotencyKey: "2e1e2b8f-1f78-4a22-909a-b5dcb44706de",
} as const;

describe("new brand validation", () => {
  it("normalises a pasted portal URL to a hostname", () => {
    expect(portalDomainInputSchema.parse(" HTTPS://PORTAL.Example.com/a?q=1#x ")).toBe("portal.example.com");
  });

  it("never accepts a non-portal hostname", () => {
    expect(portalDomainInputSchema.safeParse("franchise.example.com").success).toBe(false);
  });

  it("trims names, lowercases email, and contains no public slug input", () => {
    const parsed = createBrandSchema.parse(validPayload);
    expect(parsed.brandName).toBe("Acme Burgers");
    expect(parsed.portalDomain).toBe("portal.acmeburgers.com");
    expect(parsed.admin.email).toBe("ada@example.com");
    expect("slug" in parsed).toBe(false);
  });

  it("requires administrator identity only when invitation is enabled", () => {
    const withoutAdmin = { ...validPayload, admin: { sendInvitation: false } };
    expect(createBrandSchema.safeParse(withoutAdmin).success).toBe(true);
    expect(createBrandSchema.safeParse({ ...validPayload, admin: { sendInvitation: true } }).success).toBe(false);
  });
});
