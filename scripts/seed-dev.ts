/**
 * Local dev seed — fills kick_dev with realistic demo data so every tab
 * shows something instead of empty tables. Idempotent: uses fixed IDs +
 * upserts, safe to re-run. Runs through withTenant(systemKickContext()) so
 * RLS is respected exactly like production.
 *
 * Run: DATABASE_URL=... DIRECT_URL=... npx tsx scripts/seed-dev.ts
 * (or just: npm run seed:dev  — which loads .env.local)
 */
import { withTenant, systemKickContext } from "@/server/db/withTenant";

// Fixed IDs so .env.local's DEV_BYPASS_TENANT_ID / DEV_BYPASS_LOCATION_ID
// keep pointing at real rows across re-seeds.
const TENANT_ID = "22222222-2222-2222-2222-222222222222";
const LOC_1 = "33333333-3333-3333-3333-333333333333";
const LOC_2 = "33333333-3333-3333-3333-333333333334";
const LOC_3 = "33333333-3333-3333-3333-333333333335";

function currentPeriodLabel(): string {
  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${q}`;
}

async function main() {
  await withTenant(systemKickContext(), async (tx) => {
    // --- Tenant + branding ---
    await tx.tenant.upsert({
      where: { id: TENANT_ID },
      create: {
        id: TENANT_ID,
        name: "Maple Grove Coffee",
        slug: "maple-grove-coffee",
        theme: { primary: "#7c3aed", secondary: "#f59e0b", font: "Inter" },
      },
      update: { name: "Maple Grove Coffee", theme: { primary: "#7c3aed", secondary: "#f59e0b", font: "Inter" } },
    });

    // --- Locations (3 stores) ---
    const locations = [
      { id: LOC_1, name: "Maple Grove – Queen Street West", address: "412 Queen St W, Toronto, ON" },
      { id: LOC_2, name: "Maple Grove – Yorkville", address: "155 Cumberland St, Toronto, ON" },
      { id: LOC_3, name: "Maple Grove – Pearson Terminal 1", address: "Toronto Pearson Intl, Terminal 1, Mississauga, ON" },
    ];
    for (const loc of locations) {
      await tx.location.upsert({
        where: { id: loc.id },
        create: { id: loc.id, tenantId: TENANT_ID, name: loc.name, address: loc.address },
        update: { name: loc.name, address: loc.address },
      });
    }

    // --- Memberships (so /admin/tenants/[id] members tab shows people) ---
    const members = [
      { clerkUserId: "seed-user-priya", role: "FRANCHISOR_ADMIN" as const, locationId: null, email: "priya.sharma@maplegrovecoffee.ca", displayName: "Priya Sharma" },
      { clerkUserId: "seed-user-marcus", role: "FRANCHISEE_USER" as const, locationId: LOC_1, email: "marcus.chen@maplegrovecoffee.ca", displayName: "Marcus Chen" },
      { clerkUserId: "seed-user-sofia", role: "FRANCHISEE_USER" as const, locationId: LOC_2, email: "sofia.reyes@maplegrovecoffee.ca", displayName: "Sofia Reyes" },
    ];
    for (const m of members) {
      await tx.membership.upsert({
        where: { clerkUserId_tenantId: { clerkUserId: m.clerkUserId, tenantId: TENANT_ID } },
        create: { clerkUserId: m.clerkUserId, tenantId: TENANT_ID, role: m.role, locationId: m.locationId, email: m.email, displayName: m.displayName },
        update: { role: m.role, locationId: m.locationId, email: m.email, displayName: m.displayName },
      });
    }

    // --- Products + variants (catalog) ---
    const products = [
      { sku: "COFFEE-1KG", name: "House Blend Coffee 1kg", variants: [{ name: "Dark Roast", priceCents: 1999, stock: 120 }, { name: "Medium Roast", priceCents: 1899, stock: 80 }] },
      { sku: "CUP-12OZ", name: "Branded Paper Cups (12oz, 500ct)", variants: [{ name: "Standard", priceCents: 4500, stock: 300 }] },
      { sku: "SYRUP-VAN", name: "Vanilla Syrup 1L", variants: [{ name: "1L Bottle", priceCents: 1200, stock: 60 }] },
      { sku: "APRON", name: "Staff Apron", variants: [{ name: "Black", priceCents: 2500, stock: 40 }, { name: "Navy", priceCents: 2500, stock: 25 }] },
    ];
    const variantIds: string[] = [];
    for (const p of products) {
      const product = await tx.product.upsert({
        where: { tenantId_sku: { tenantId: TENANT_ID, sku: p.sku } },
        create: { tenantId: TENANT_ID, sku: p.sku, name: p.name, active: true },
        update: { name: p.name, active: true },
      });
      for (const v of p.variants) {
        const existing = await tx.productVariant.findFirst({ where: { productId: product.id, name: v.name } });
        const variant = existing
          ? await tx.productVariant.update({ where: { id: existing.id }, data: { priceCents: v.priceCents, stock: v.stock } })
          : await tx.productVariant.create({ data: { productId: product.id, name: v.name, priceCents: v.priceCents, stock: v.stock } });
        variantIds.push(variant.id);
      }
    }

    // --- Ordering rules ---
    const firstProduct = await tx.product.findFirstOrThrow({ where: { tenantId: TENANT_ID, sku: "COFFEE-1KG" } });
    const existingRule = await tx.locationOrderingRule.findFirst({ where: { locationId: LOC_1, productId: firstProduct.id } });
    if (!existingRule) {
      await tx.locationOrderingRule.create({ data: { locationId: LOC_1, productId: firstProduct.id, minQty: 1, maxQty: 20, cadenceDays: 14 } });
    }

    // --- Allowances (current period, one per store) ---
    const period = currentPeriodLabel();
    const allowanceGrants = [
      { locationId: LOC_1, grantedCents: 50_000 },
      { locationId: LOC_2, grantedCents: 30_000 },
      { locationId: LOC_3, grantedCents: 15_000 },
    ];
    for (const g of allowanceGrants) {
      // Initial grant lives in grantedCents only — matching the real
      // grantAllowance service, which writes a GRANT ledger row ONLY for
      // additional top-ups on a pre-existing allowance, never the first grant.
      // (Balance = grantedCents + SUM(ledger deltas); no ledger row here.)
      await tx.allowance.upsert({
        where: { locationId_periodLabel: { locationId: g.locationId, periodLabel: period } },
        create: { tenantId: TENANT_ID, locationId: g.locationId, periodLabel: period, grantedCents: g.grantedCents, overflow: "CHARGE_CARD", createdBy: "seed" },
        update: { grantedCents: g.grantedCents },
      });
    }

    // --- Announcements (pinned + scheduled + published) ---
    const announcements = [
      { title: "New Fall Menu Launches Monday", body: "The pumpkin spice line goes live storewide next week. Update your boards.", isPinned: true, requiresAck: true, status: "PUBLISHED" as const },
      { title: "Holiday Hours Reminder", body: "All locations close at 6pm on Dec 24 and remain closed Dec 25.", isPinned: false, requiresAck: false, status: "PUBLISHED" as const },
      { title: "Q3 Loyalty Program Update", body: "Double points weekend is coming — details to follow.", isPinned: false, requiresAck: false, status: "PUBLISHED" as const },
    ];
    for (const a of announcements) {
      const existing = await tx.announcement.findFirst({ where: { tenantId: TENANT_ID, title: a.title } });
      if (!existing) {
        await tx.announcement.create({
          data: { tenantId: TENANT_ID, title: a.title, body: a.body, isPinned: a.isPinned, requiresAck: a.requiresAck, status: a.status, publishAt: new Date(), createdBy: "seed" },
        });
      }
    }

    // --- Tasks (assigned to locations, some overdue) ---
    const taskDefs = [
      { title: "Complete monthly fridge temperature log", dueInDays: 3, locations: [LOC_1, LOC_2, LOC_3] },
      { title: "Deep-clean espresso machines", dueInDays: -2, locations: [LOC_1, LOC_2] }, // overdue
      { title: "Submit weekly waste report", dueInDays: 7, locations: [LOC_1] },
    ];
    for (const t of taskDefs) {
      const existing = await tx.task.findFirst({ where: { tenantId: TENANT_ID, title: t.title } });
      if (!existing) {
        const dueAt = new Date(Date.now() + t.dueInDays * 24 * 60 * 60 * 1000);
        await tx.task.create({
          data: {
            tenantId: TENANT_ID,
            title: t.title,
            dueAt,
            createdBy: "seed",
            assignments: { create: t.locations.map((locationId) => ({ locationId })) },
          },
        });
      }
    }
    // Mark one assignment complete so completion stats aren't all zero.
    const cleanTask = await tx.task.findFirst({ where: { tenantId: TENANT_ID, title: "Deep-clean espresso machines" }, include: { assignments: true } });
    const firstAssignment = cleanTask?.assignments.find((x) => x.locationId === LOC_1);
    if (firstAssignment && firstAssignment.status !== "COMPLETED") {
      await tx.taskAssignment.update({ where: { id: firstAssignment.id }, data: { status: "COMPLETED", completedAt: new Date(), completedBy: "seed-user-marcus" } });
    }

    // --- Onboarding template + progress ---
    let template = await tx.onboardingTemplate.findFirst({ where: { tenantId: TENANT_ID, name: "New Store Setup" }, include: { items: true } });
    if (!template) {
      template = await tx.onboardingTemplate.create({
        data: {
          tenantId: TENANT_ID,
          name: "New Store Setup",
          items: {
            create: [
              { title: "Sign franchise agreement", order: 0 },
              { title: "Complete brand training", order: 1 },
              { title: "Install POS system", order: 2 },
              { title: "Stock initial inventory", order: 3 },
              { title: "Pass health inspection", order: 4 },
            ],
          },
        },
        include: { items: true },
      });
    }
    // LOC_1 completed the first 3 items (shows a partial progress bar).
    const orderedItems = [...template.items].sort((a, b) => a.order - b.order);
    for (let i = 0; i < 3 && i < orderedItems.length; i++) {
      const item = orderedItems[i]!;
      await tx.onboardingProgress.upsert({
        where: { locationId_itemId: { locationId: LOC_1, itemId: item.id } },
        create: { locationId: LOC_1, templateId: template.id, itemId: item.id, done: true, doneAt: new Date(), doneBy: "seed-user-marcus" },
        update: { done: true },
      });
    }

    // --- An order or two (so /admin/orders and franchisee order history aren't empty) ---
    const coffeeVariant = await tx.productVariant.findFirstOrThrow({ where: { product: { sku: "COFFEE-1KG" }, name: "Dark Roast" } });
    const cupVariant = await tx.productVariant.findFirstOrThrow({ where: { product: { sku: "CUP-12OZ" } } });
    const orderKey = "seed-order-1";
    const existingOrder = await tx.order.findUnique({ where: { idempotencyKey: orderKey } });
    if (!existingOrder) {
      const subtotal = coffeeVariant.priceCents * 3 + cupVariant.priceCents * 1; // 3 coffee + 1 cups box
      await tx.order.create({
        data: {
          tenantId: TENANT_ID,
          locationId: LOC_1,
          status: "PAID",
          subtotalCents: subtotal,
          allowanceAppliedCents: subtotal, // fully covered by allowance
          cardChargedCents: 0,
          idempotencyKey: orderKey,
          placedBy: "seed-user-marcus",
          lines: {
            create: [
              { variantId: coffeeVariant.id, qty: 3, unitPriceCents: coffeeVariant.priceCents },
              { variantId: cupVariant.id, qty: 1, unitPriceCents: cupVariant.priceCents },
            ],
          },
        },
      });
    }
  });

  console.log("✅ Dev data seeded into kick_dev (tenant Maple Grove Coffee, 3 stores, catalog, allowances, announcements, tasks, onboarding, 1 order).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
