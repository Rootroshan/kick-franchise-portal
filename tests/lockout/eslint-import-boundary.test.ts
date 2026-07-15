import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Layer 3 of the franchisor lockout: proves the ESLint no-restricted-imports
 * rule in .eslintrc.json actually fails the build if franchisor code
 * imports a commerce/allowance/rebate module. This is what makes "franchisor
 * code cannot import commerce modules" a compile-time guarantee rather than
 * a code-review convention.
 */
describe("ESLint: franchisor code cannot import commerce/allowance/rebate modules", () => {
  it("fails lint on a file under app/franchisor importing the commerce module", () => {
    const tmpFile = join(process.cwd(), "app", "franchisor", "__lockout_test_violation__.ts");
    writeFileSync(
      tmpFile,
      `import { listProducts } from "@/server/modules/commerce/products";\nexport { listProducts };\n`
    );

    try {
      let failed = false;
      let output = "";
      try {
        output = execFileSync("npx", ["eslint", tmpFile], { encoding: "utf-8", cwd: process.cwd() });
      } catch (err: unknown) {
        failed = true;
        output = String((err as { stdout?: string })?.stdout ?? err);
      }
      expect(failed).toBe(true);
      expect(output).toMatch(/no-restricted-imports|LOCKOUT VIOLATION/i);
    } finally {
      rmSync(tmpFile, { force: true });
    }
  }, 30_000);

  it("passes lint on the same file importing a non-commerce module (sanity check the rule isn't overly broad)", () => {
    const tmpFile = join(process.cwd(), "app", "franchisor", "__lockout_test_ok__.ts");
    writeFileSync(
      tmpFile,
      `import { listAnnouncements } from "@/server/modules/announcements/service";\nexport { listAnnouncements };\n`
    );

    try {
      let failed = false;
      try {
        execFileSync("npx", ["eslint", tmpFile], { encoding: "utf-8", cwd: process.cwd() });
      } catch {
        failed = true;
      }
      expect(failed).toBe(false);
    } finally {
      rmSync(tmpFile, { force: true });
    }
  }, 30_000);
});
