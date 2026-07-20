import { describe, it, expect } from "vitest";
import { updateTenantSchema } from "@/server/modules/tenants/schemas";

/**
 * The brand website is rendered into an href on Brand Detail. z.string().url()
 * accepts javascript: and data: — both are well-formed URLs — so without a
 * scheme restriction a KICK_ADMIN could store one and it would render as a
 * clickable script payload. Stored XSS, admin-to-admin.
 */
describe("brand website scheme validation", () => {
  it("rejects script-bearing schemes that url() alone accepts", () => {
    const dangerous = [
      "javascript:alert(1)",
      "JavaScript:alert(1)", // scheme is case-insensitive
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
    ];

    for (const website of dangerous) {
      expect(updateTenantSchema.safeParse({ website }).success, website).toBe(false);
    }
  });

  it("accepts http and https", () => {
    for (const website of ["http://example.com", "https://example.com/path"]) {
      expect(updateTenantSchema.safeParse({ website }).success, website).toBe(true);
    }
  });

  it("still accepts the empty string, so the field can be cleared", () => {
    expect(updateTenantSchema.safeParse({ website: "" }).success).toBe(true);
  });
});
