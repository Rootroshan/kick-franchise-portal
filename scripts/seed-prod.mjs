/**
 * Production seed — inserts a minimal, coherent demo dataset using SMALL
 * per-statement commits (autocommit), so it works over a remote/proxied
 * Postgres connection where the dev seed's single 30s+ transaction times out.
 *
 * Idempotent: every insert uses ON CONFLICT DO NOTHING / fixed UUIDs.
 * Run: DBURL=<superuser direct url> node scripts/seed-prod.mjs
 */
import pg from "pg";

const url = process.env.DBURL;
if (!url) { console.error("Need DBURL (superuser)"); process.exit(1); }
const c = new pg.Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/i, ""), ssl: { rejectUnauthorized: false } });

const TENANT = "22222222-2222-2222-2222-222222222222";
const LOC1 = "33333333-3333-3333-3333-333333333333";
const LOC2 = "33333333-3333-3333-3333-333333333334";
const LOC3 = "33333333-3333-3333-3333-333333333335";

async function q(sql, params) { return c.query(sql, params); }

async function main() {
  await c.connect();

  // Brand
  await q(
    `INSERT INTO "Tenant" (id,name,slug,status,theme,"createdAt","updatedAt")
     VALUES ($1,'Maple Grove Coffee','maple-grove-coffee','active',$2,now(),now())
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, slug=EXCLUDED.slug, status='active'`,
    [TENANT, JSON.stringify({ primary: "#7c3aed", secondary: "#f59e0b", font: "Inter" })]
  );

  // Stores
  const stores = [
    [LOC1, "Maple Grove – Queen Street West", "620 Queen St W, Toronto, ON"],
    [LOC2, "Maple Grove – Yorkville", "155 Cumberland St, Toronto, ON"],
    [LOC3, "Maple Grove – Pearson Terminal 1", "Toronto Pearson Intl, T1, Mississauga, ON"],
  ];
  for (const [id, name, addr] of stores) {
    await q(
      `INSERT INTO "Location" (id,"tenantId",name,address,status,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,'active',now(),now()) ON CONFLICT (id) DO NOTHING`,
      [id, TENANT, name, addr]
    );
  }

  // Memberships (roles the portals need). clerkUserId placeholders are updated
  // to real Clerk ids when those users sign in + are granted roles.
  const members = [
    ["seed-user-priya", "FRANCHISOR_ADMIN", null, "priya.sharma@maplegrovecoffee.ca", "Priya Sharma"],
    ["seed-user-marcus", "FRANCHISEE_USER", LOC1, "marcus.chen@maplegrovecoffee.ca", "Marcus Chen"],
    ["seed-user-sofia", "FRANCHISEE_USER", LOC2, "sofia.reyes@maplegrovecoffee.ca", "Sofia Reyes"],
  ];
  for (const [uid, role, loc, email, name] of members) {
    await q(
      `INSERT INTO "Membership" (id,"clerkUserId","tenantId","locationId",role,email,"displayName","createdAt","updatedAt")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,now(),now())
       ON CONFLICT ("clerkUserId","tenantId") DO NOTHING`,
      [uid, TENANT, loc, role, email, name]
    );
  }

  // Products + variants
  const products = [
    ["COFFEE-1KG", "House Blend Coffee 1kg", [["Dark Roast", 1999, 120], ["Medium Roast", 1899, 80]]],
    ["CUP-12OZ", "Branded Paper Cups (12oz, 500ct)", [["Standard", 4500, 300]]],
    ["SYRUP-VAN", "Vanilla Syrup 1L", [["1L Bottle", 1200, 60]]],
    ["APRON", "Staff Apron", [["Black", 2500, 40], ["Navy", 2500, 25]]],
  ];
  for (const [sku, name, variants] of products) {
    const pr = await q(
      `INSERT INTO "Product" (id,"tenantId",sku,name,active,"createdAt","updatedAt")
       VALUES (gen_random_uuid(),$1,$2,$3,true,now(),now())
       ON CONFLICT ("tenantId",sku) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      [TENANT, sku, name]
    );
    const pid = pr.rows[0].id;
    for (const [vname, price, stock] of variants) {
      await q(
        `INSERT INTO "ProductVariant" (id,"productId",name,"priceCents",currency,stock,active,"createdAt","updatedAt")
         VALUES (gen_random_uuid(),$1,$2,$3,'CAD',$4,true,now(),now())
         ON CONFLICT DO NOTHING`,
        [pid, vname, price, stock]
      );
    }
  }

  // Allowances (per store, current quarter)
  const now = new Date();
  const period = `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
  for (const [loc, granted] of [[LOC1, 95000], [LOC2, 30000], [LOC3, 15000]]) {
    await q(
      `INSERT INTO "Allowance" (id,"tenantId","locationId","periodLabel","grantedCents",currency,overflow,"createdBy","createdAt")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,'CAD','CHARGE_CARD','seed',now())
       ON CONFLICT ("locationId","periodLabel") DO NOTHING`,
      [TENANT, loc, period, granted]
    );
  }

  // Announcements
  const anns = [
    ["New Fall Menu Launches Monday", "The pumpkin spice line goes live storewide next week. Update your boards.", true, true],
    ["Holiday Trading Hours", "Extended hours Dec 20–24. Confirm staffing.", false, false],
    ["Q3 Loyalty Program Update", "Double points weekend is coming — details to follow.", false, false],
  ];
  for (const [title, body, pinned, ack] of anns) {
    await q(
      `INSERT INTO "Announcement" (id,"tenantId",title,body,"isPinned","requiresAck",status,"publishAt","createdBy","createdAt","updatedAt")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,'PUBLISHED',now(),'seed',now(),now())
       ON CONFLICT DO NOTHING`,
      [TENANT, title, body, pinned, ack]
    );
  }

  const t = await q(`SELECT count(*)::int n FROM "Tenant"`);
  const p = await q(`SELECT count(*)::int n FROM "Product"`);
  console.log(`✅ prod seed done: tenants=${t.rows[0].n} products=${p.rows[0].n}`);
  await c.end();
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
