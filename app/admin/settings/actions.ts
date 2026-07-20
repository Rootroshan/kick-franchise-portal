"use server";

import { requireRole } from "@/server/modules/identity/guard";
import { testStripe, testR2, type TestResult } from "@/server/modules/dashboard/connectionTest";

/**
 * Runs a live connection test against an external integration.
 *
 * KICK_ADMIN-gated: these calls hit third-party APIs using platform credentials,
 * so they must not be reachable by tenant-scoped roles. The returned message is
 * pre-sanitised by connectionTest.ts and never contains credential material.
 */
export async function testConnectionAction(service: "stripe" | "r2"): Promise<TestResult> {
  await requireRole("KICK_ADMIN")();

  switch (service) {
    case "stripe":
      return testStripe();
    case "r2":
      return testR2();
    default:
      return { ok: false, message: "Unknown service." };
  }
}
