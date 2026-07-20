import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { vi } from "vitest";

const authState = { userId: null as string | null, host: "" };

vi.mock("@/server/auth/config", () => ({
  auth: async () => (authState.userId ? { user: { id: authState.userId } } : null),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["host", authState.host]]) as unknown as Headers,
}));
vi.mock("@/server/lib/stripe", () => ({
  stripeClient: () => ({
    paymentIntents: { create: async () => ({ id: "pi_test", client_secret: "secret_test", amount: 0, currency: "cad" }) },
  }),
}));

import { withTenant } from "@/server/db/withTenant";
import { kickCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";

// Import every commerce/allowance/rebate route handler module directly —
// these are the ACTUAL production route handlers, not a re-derivation.
import * as commerceProducts from "@/app/api/commerce/products/route";
import * as commerceProductById from "@/app/api/commerce/products/[id]/route";
import * as commerceVariants from "@/app/api/commerce/variants/route";
import * as commerceVariantById from "@/app/api/commerce/variants/[id]/route";
import * as commerceOrderingRules from "@/app/api/commerce/ordering-rules/route";
import * as ordersCheckout from "@/app/api/orders/checkout/route";
import * as ordersIndex from "@/app/api/orders/route";
import * as allowancesIndex from "@/app/api/allowances/route";
import * as allowancesUsageReport from "@/app/api/allowances/usage-report/route";
import * as rebatesRules from "@/app/api/rebates/rules/route";
import * as rebatesReports from "@/app/api/rebates/reports/route";
import * as rebatesReportDownload from "@/app/api/rebates/reports/[id]/download/route";
import * as allowancesMe from "@/app/api/allowances/me/route";

type RouteModule = Record<string, ((req: Request) => Promise<Response>) | undefined>;

// Every [method, module, path] triple that constitutes commerce/allowance/rebate
// administration or data per spec §17. Franchisor must receive 403 on every one.
const PROTECTED_ROUTES: Array<{ name: string; method: "GET" | "POST" | "PATCH"; mod: RouteModule; path: string }> = [
  { name: "commerce/products GET", method: "GET", mod: commerceProducts as RouteModule, path: "/api/commerce/products" },
  { name: "commerce/products POST", method: "POST", mod: commerceProducts as RouteModule, path: "/api/commerce/products" },
  { name: "commerce/products/:id PATCH", method: "PATCH", mod: commerceProductById as RouteModule, path: "/api/commerce/products/00000000-0000-0000-0000-000000000000" },
  { name: "commerce/variants POST", method: "POST", mod: commerceVariants as RouteModule, path: "/api/commerce/variants" },
  { name: "commerce/variants/:id PATCH", method: "PATCH", mod: commerceVariantById as RouteModule, path: "/api/commerce/variants/00000000-0000-0000-0000-000000000000" },
  { name: "commerce/ordering-rules POST", method: "POST", mod: commerceOrderingRules as RouteModule, path: "/api/commerce/ordering-rules" },
  { name: "orders/checkout POST", method: "POST", mod: ordersCheckout as RouteModule, path: "/api/orders/checkout" },
  { name: "orders GET", method: "GET", mod: ordersIndex as RouteModule, path: "/api/orders" },
  { name: "allowances GET", method: "GET", mod: allowancesIndex as RouteModule, path: "/api/allowances" },
  { name: "allowances POST", method: "POST", mod: allowancesIndex as RouteModule, path: "/api/allowances" },
  { name: "allowances/usage-report GET", method: "GET", mod: allowancesUsageReport as RouteModule, path: "/api/allowances/usage-report" },
  { name: "rebates/rules GET", method: "GET", mod: rebatesRules as RouteModule, path: "/api/rebates/rules" },
  { name: "rebates/rules POST", method: "POST", mod: rebatesRules as RouteModule, path: "/api/rebates/rules" },
  { name: "rebates/reports GET", method: "GET", mod: rebatesReports as RouteModule, path: "/api/rebates/reports" },
  {
    name: "rebates/reports/:id/download GET",
    method: "GET",
    mod: rebatesReportDownload as RouteModule,
    path: "/api/rebates/reports/00000000-0000-0000-0000-000000000000/download?format=csv",
  },
  { name: "allowances/me GET (franchisor is not a franchisee)", method: "GET", mod: allowancesMe as RouteModule, path: "/api/allowances/me" },
];

function makeRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`http://test.local${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Lockout: every commerce/allowance/rebate route handler returns 403 for FRANCHISOR_ADMIN", () => {
  let tenantId: string;
  let tenantSlug: string;

  beforeAll(async () => {
    process.env.APP_BASE_DOMAIN = "portal.kickmedia.test";
  });

  beforeEach(async () => {
    await resetDatabase();
    const { tenant } = await seedTenantWithLocation();
    tenantId = tenant.id;
    tenantSlug = tenant.slug;

    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: { clerkUserId: "franchisor-lockout-test", tenantId, role: "FRANCHISOR_ADMIN" },
      })
    );
    authState.userId = "franchisor-lockout-test";
    authState.host = `${tenantSlug}.portal.kickmedia.test`;
  });

  for (const route of PROTECTED_ROUTES) {
    it(`${route.name} -> 403`, async () => {
      const handler = route.mod[route.method];
      expect(handler, `Route module for ${route.name} does not export ${route.method}`).toBeDefined();

      const req = makeRequest(route.method, route.path, route.method !== "GET" ? {} : undefined);
      const res = await handler!(req);
      expect(res.status).toBe(403);
    });
  }

  it("a FRANCHISEE_USER token also cannot reach KICK_ADMIN-only commerce writes (products POST)", async () => {
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: { clerkUserId: "franchisee-lockout-test", tenantId, role: "FRANCHISEE_USER" },
      })
    );
    authState.userId = "franchisee-lockout-test";

    const res = await commerceProducts.POST(makeRequest("POST", "/api/commerce/products", { name: "x", sku: "x" }));
    expect(res.status).toBe(403);
  });

  it("an unauthenticated request receives 401, not a silent pass-through", async () => {
    authState.userId = null;
    const res = await commerceProducts.GET(makeRequest("GET", "/api/commerce/products"));
    expect(res.status).toBe(401);
  });
});
