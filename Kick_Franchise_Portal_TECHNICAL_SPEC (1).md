# Kick Franchise Portal — Technical Build Spec (Developer Handoff)

> **Audience:** the engineer (human or Claude Code) building this.
> **Purpose:** everything needed to start building on day one — stack, schema, the security model, every module's behaviour, the tricky money logic, and how to ship it.
> **Golden rule:** Franchisors must be *technically* unable to reach any commerce data or config. This is enforced at four layers (see §5). Treat any path that lets a franchisor touch the shop as a P0 bug.

---

## Table of Contents
1. Overview & scope
2. Tech stack & versions
3. Accounts & environment variables
4. Repository structure
5. The franchisor lockout (security model) — read first
6. Multi-tenancy & request context
7. Data model (full Prisma schema)
8. Row-Level Security (RLS) policies
9. Auth & RBAC
10. Module specs (the 8 features) with acceptance criteria
11. The hard parts: allowances, rebates, checkout concurrency
12. Background jobs
13. Payments (Stripe)
14. File storage & signed downloads
15. Push notifications & PWA
16. Frontend architecture & routing
17. API surface (endpoint list)
18. Testing strategy (lockout tests are mandatory)
19. Deployment, CI/CD, migrations
20. Build order (8–12 week milestones)
21. Open decisions to confirm
22. Definition of done

---

## 1. Overview & scope

A multi-tenant franchise portal. One platform serves many **franchisors** (tenants); each franchisor has many **franchisee locations** (stores). Kick administers everything.

Eight modules: Announcements, Artwork Hub, Tasks, Onboarding, Ordering, Allowances, Rebates, Mobile/Push. Ecommerce is one module among many and is **Kick-controlled only**.

**Three roles:** `KICK_ADMIN`, `FRANCHISOR_ADMIN`, `FRANCHISEE_USER`.

---

## 2. Tech stack & versions

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript 5.x (strict) | end-to-end |
| Framework | Next.js 14+ (App Router) | full-stack: UI + route handlers |
| Runtime | Node 20 LTS | |
| DB | PostgreSQL 15+ | Neon or Supabase (managed) |
| ORM | Prisma 5.x | with RLS context via interactive transactions |
| Auth | Clerk | Organizations = franchisors; org roles map to our roles |
| Background jobs | BullMQ + Redis (Upstash) | separate worker process |
| Payments | Stripe | Kick's single account |
| File storage | Cloudflare R2 (S3 API) | private bucket, signed URLs |
| Email | Resend | transactional + announcements |
| Push | Web Push (VAPID) via `web-push` | PWA |
| Styling | Tailwind + shadcn/ui | per-tenant theming via CSS vars |
| Analytics | PostHog | engagement metrics |
| Errors | Sentry | client + server |
| Hosting | Vercel (app) + Railway/Render (worker) | |
| Validation | Zod | all API inputs |
| Testing | Vitest + Playwright | unit + e2e, incl. lockout tests |

> **Alternative considered:** a dedicated NestJS API instead of Next route handlers. Stick with Next route handlers unless the API grows past ~60 endpoints or needs to be consumed by external clients; module boundaries below give the same isolation.

---

## 3. Accounts & environment variables

Create accounts (in **Kick's** name where they bill): Vercel, Neon/Supabase, Clerk, Stripe, Cloudflare R2, Upstash, Resend, Sentry, PostHog.

`.env` (never commit; use Vercel/Railway secret stores):

```bash
# Database — two URLs: one pooled for app, one direct for migrations
DATABASE_URL="postgresql://app_user:...@host/db?sslmode=require"   # app role (RLS-enforced)
DIRECT_URL="postgresql://owner:...@host/db?sslmode=require"        # migrations only

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=kick-assets
R2_PUBLIC_BASE=            # leave empty — we use signed URLs only

# Redis / queue
REDIS_URL=

# Email
RESEND_API_KEY=

# Web Push
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:ops@kickmedia.com

# App
APP_BASE_DOMAIN=portal.kickmedia.com   # wildcard: *.portal.kickmedia.com
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
```

> **Critical DB detail:** the app connects as a **non-superuser role** (`app_user`) so RLS is enforced. Migrations run as the owner via `DIRECT_URL`. RLS does **not** apply to superusers/table owners — if the app connects as owner, every policy is silently bypassed. Verify `app_user` is not a member of `BYPASSRLS`.

---

## 4. Repository structure

Single Next.js app + a worker. Monorepo optional; a single package is fine to start.

```
/app
  /(franchisee)        # default surface at brand subdomains — store users
  /franchisor          # FRANCHISOR_ADMIN surface — NO commerce components exist here
  /admin               # KICK_ADMIN surface — full control incl. commerce
  /api                 # route handlers (grouped by module)
    /announcements
    /assets
    /tasks
    /onboarding
    /commerce          # guarded: KICK_ADMIN only for writes
    /orders            # franchisee places orders; reads scoped to their location
    /allowances        # KICK_ADMIN only
    /rebates           # KICK_ADMIN only
    /push
    /webhooks/stripe
    /webhooks/clerk
/src
  /server
    /modules           # business logic, one folder per module
      /announcements
      /assets
      /tasks
      /onboarding
      /commerce        # NOT imported by anything under /franchisor
      /allowances
      /rebates
      /identity        # tenant context, RBAC, audit
    /db                # prisma client, withTenant() helper, RLS context
    /lib               # stripe, r2, push, email, posthog
  /components          # shared UI (shadcn)
  /styles
/prisma
  schema.prisma
  /migrations
  rls.sql              # RLS policies applied after migrate
/worker
  index.ts             # BullMQ workers + cron
/tests
  /lockout             # mandatory: franchisor-cannot-reach-commerce suite
middleware.ts          # subdomain → tenant resolution + auth gate
```

**Lockout structural rule:** nothing under `/app/franchisor` or its server modules may import from `/src/server/modules/commerce`, `/allowances`, or `/rebates`. Add an ESLint `no-restricted-imports` rule to enforce this at build time.

---

## 5. The franchisor lockout (security model) — READ FIRST

Defense in depth. A franchisor identity must fail at **every** layer:

**Layer 1 — UI.** The `/franchisor` surface ships zero commerce/allowance/rebate components. Nothing to click, no routes.

**Layer 2 — API RBAC.** Every commerce/allowance/rebate route handler is wrapped in `requireRole('KICK_ADMIN')`. Non-Kick tokens get `403` before any logic runs.

**Layer 3 — Module boundaries.** Commerce/allowance/rebate logic lives in modules never imported by franchisor code. Enforced by ESLint `no-restricted-imports` (build fails otherwise).

**Layer 4 — Database RLS.** Commerce tables have policies that only return rows when `app.user_role = 'KICK_ADMIN'`. Even a buggy query run under a franchisor session returns zero rows and cannot write.

**Plus:** every privileged action writes an `AuditLog` row. A test suite (`/tests/lockout`) asserts a franchisor token receives 403 on every commerce endpoint AND that RLS hides commerce rows. This suite must pass in CI to deploy.

---

## 6. Multi-tenancy & request context

- **Model:** shared database, shared schema, `tenantId` on every tenant-scoped row, isolated by RLS.
- **Tenant resolution:** `middleware.ts` reads the `Host` header → looks up `Tenant.slug`/`customDomain` → attaches `tenantId` to the request. Combined with the Clerk session's org, it validates the user belongs to that tenant.
- **Per-request DB context:** wrap all queries for a request in an interactive transaction that first sets Postgres session GUCs, so RLS policies can read them.

```ts
// src/server/db/withTenant.ts
import { prisma } from "./client";

type Ctx = { tenantId: string | null; role: Role; locationId: string | null; userId: string };

export async function withTenant<T>(ctx: Ctx, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${ctx.tenantId ?? ""}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.user_role = '${ctx.role}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.location_id = '${ctx.locationId ?? ""}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${ctx.userId}'`);
    return fn(tx);
  });
}
```

> Values come from the verified Clerk session + tenant lookup, never from user input — but still validate they are UUIDs before interpolating to avoid SQL injection into the `SET LOCAL`. Prefer `set_config('app.tenant_id', $1, true)` with bound params if your driver allows it.

> **Kick admins** operate cross-tenant. For Kick admin reads that span tenants, set `app.user_role='KICK_ADMIN'` and write policies that bypass the tenant filter for that role (see §8).

---

## 7. Data model (full Prisma schema)

Money is stored as **integer minor units** (`Int` cents) with an explicit `currency`. All IDs are `uuid`.

```prisma
// prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum Role { KICK_ADMIN FRANCHISOR_ADMIN FRANCHISEE_USER }
enum AssetStatus { ACTIVE ARCHIVED DEPRECATED }
enum AnnouncementStatus { DRAFT SCHEDULED PUBLISHED EXPIRED }
enum TaskStatus { OPEN COMPLETED }
enum OrderStatus { PENDING PAID CANCELLED REFUNDED FULFILLED }
enum RebateType { FLAT PERCENT }
enum OverflowBehavior { BLOCK CHARGE_CARD }     // what to do when allowance < order total
enum LedgerReason { GRANT ORDER_DEBIT REFUND_CREDIT ADJUSTMENT EXPIRY }

model Tenant {
  id           String   @id @default(uuid())
  name         String
  slug         String   @unique               // brandx → brandx.portal.kickmedia.com
  customDomain String?  @unique
  theme        Json     @default("{}")         // { logoUrl, primary, secondary, font }
  status       String   @default("active")
  createdAt    DateTime @default(now())

  locations    Location[]
  memberships  Membership[]
  announcements Announcement[]
  assets       Asset[]
  tasks        Task[]
  onboardingTemplates OnboardingTemplate[]
  products     Product[]
}

model Location {                                 // a franchisee store
  id        String   @id @default(uuid())
  tenantId  String
  name      String
  address   String?
  status    String   @default("active")
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  memberships Membership[]
  orders    Order[]
  allowances Allowance[]
  orderingRules LocationOrderingRule[]
  onboardingProgress OnboardingProgress[]
  taskAssignments TaskAssignment[]
  @@index([tenantId])
}

model Membership {                               // mirrors Clerk user → role/tenant/location
  id          String  @id @default(uuid())
  clerkUserId String
  tenantId    String?                            // null for Kick admins (cross-tenant)
  locationId  String?
  role        Role
  tenant      Tenant?   @relation(fields: [tenantId], references: [id])
  location    Location? @relation(fields: [locationId], references: [id])
  @@unique([clerkUserId, tenantId])
  @@index([tenantId])
}

// ---------- Communication ----------
model Announcement {
  id          String   @id @default(uuid())
  tenantId    String
  title       String
  body        String
  isPinned    Boolean  @default(false)
  publishAt   DateTime?
  expiresAt   DateTime?
  requiresAck Boolean  @default(false)
  status      AnnouncementStatus @default(DRAFT)
  createdAt   DateTime @default(now())
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  acks        AnnouncementAck[]
  @@index([tenantId, status, isPinned])
}
model AnnouncementAck {
  id             String   @id @default(uuid())
  announcementId String
  clerkUserId    String
  locationId     String?
  acknowledgedAt DateTime @default(now())
  announcement   Announcement @relation(fields: [announcementId], references: [id])
  @@unique([announcementId, clerkUserId])
}

// ---------- Brand Asset Hub ----------
model Asset {
  id         String   @id @default(uuid())
  tenantId   String
  name       String
  type       String   // logo | signage | menuboard | campaign | template
  storageKey String   // R2 object key
  mime       String
  sizeBytes  Int
  version    Int      @default(1)
  status     AssetStatus @default(ACTIVE)
  createdAt  DateTime @default(now())
  tenant     Tenant   @relation(fields: [tenantId], references: [id])
  @@index([tenantId, status])
}

// ---------- Tasks ----------
model Task {
  id        String   @id @default(uuid())
  tenantId  String
  title     String
  details   String?
  dueAt     DateTime?
  createdAt DateTime @default(now())
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  assignments TaskAssignment[]
  @@index([tenantId])
}
model TaskAssignment {
  id         String   @id @default(uuid())
  taskId     String
  locationId String
  status     TaskStatus @default(OPEN)
  completedAt DateTime?
  completedBy String?
  task       Task     @relation(fields: [taskId], references: [id])
  location   Location @relation(fields: [locationId], references: [id])
  @@unique([taskId, locationId])
  @@index([locationId, status])
}

// ---------- Onboarding ----------
model OnboardingTemplate {
  id        String @id @default(uuid())
  tenantId  String
  name      String
  tenant    Tenant @relation(fields: [tenantId], references: [id])
  items     OnboardingItem[]
  @@index([tenantId])
}
model OnboardingItem {
  id         String @id @default(uuid())
  templateId String
  title      String
  order      Int
  template   OnboardingTemplate @relation(fields: [templateId], references: [id])
}
model OnboardingProgress {
  id         String @id @default(uuid())
  locationId String
  templateId String
  itemId     String
  done       Boolean @default(false)
  doneAt     DateTime?
  location   Location @relation(fields: [locationId], references: [id])
  @@unique([locationId, itemId])
  @@index([locationId])
}

// ---------- Commerce (KICK-CONTROLLED) ----------
model Product {
  id        String   @id @default(uuid())
  tenantId  String                              // catalog is per-brand but Kick-managed
  name      String
  sku       String
  active    Boolean  @default(true)
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  variants  ProductVariant[]
  rebateRules RebateRule[]
  @@unique([tenantId, sku])
  @@index([tenantId])
}
model ProductVariant {
  id         String @id @default(uuid())
  productId  String
  name       String
  priceCents Int
  currency   String @default("CAD")
  stock      Int?                                // null = untracked
  product    Product @relation(fields: [productId], references: [id])
  orderLines OrderLine[]
}
model LocationOrderingRule {
  id          String @id @default(uuid())
  locationId  String
  productId   String?                            // null = applies to all
  minQty      Int?
  maxQty      Int?
  cadenceDays Int?                               // e.g. can order every 30 days
  location    Location @relation(fields: [locationId], references: [id])
  @@index([locationId])
}
model Order {
  id          String   @id @default(uuid())
  tenantId    String
  locationId  String
  status      OrderStatus @default(PENDING)
  subtotalCents Int
  allowanceAppliedCents Int @default(0)
  cardChargedCents Int @default(0)
  currency    String  @default("CAD")
  stripePaymentIntentId String?
  createdAt   DateTime @default(now())
  location    Location @relation(fields: [locationId], references: [id])
  lines       OrderLine[]
  ledgerEntries AllowanceLedger[]
  @@index([tenantId, locationId, status])
}
model OrderLine {
  id         String @id @default(uuid())
  orderId    String
  variantId  String
  qty        Int
  unitPriceCents Int                              // price snapshot at order time
  order      Order @relation(fields: [orderId], references: [id])
  variant    ProductVariant @relation(fields: [variantId], references: [id])
  rebateAccruals RebateAccrual[]
}

// ---------- Allowances (KICK-CONTROLLED) ----------
model Allowance {
  id            String @id @default(uuid())
  tenantId      String
  locationId    String
  periodLabel   String                            // e.g. "2026-Q3"
  grantedCents  Int
  currency      String @default("CAD")
  overflow      OverflowBehavior @default(CHARGE_CARD)  // CONFIRMED: charge card for the remainder
  createdAt     DateTime @default(now())
  location      Location @relation(fields: [locationId], references: [id])
  ledger        AllowanceLedger[]
  @@index([tenantId, locationId])
}
model AllowanceLedger {                            // APPEND-ONLY. Never update/delete.
  id           String @id @default(uuid())
  allowanceId  String
  orderId      String?
  deltaCents   Int                                // negative = debit, positive = credit
  balanceAfter Int
  reason       LedgerReason
  createdAt    DateTime @default(now())
  allowance    Allowance @relation(fields: [allowanceId], references: [id])
  order        Order?    @relation(fields: [orderId], references: [id])
  @@index([allowanceId, createdAt])
}

// ---------- Rebates (KICK-CONTROLLED) ----------
model RebateRule {
  id          String @id @default(uuid())
  tenantId    String
  productId   String
  type        RebateType
  value       Int                                 // FLAT = cents; PERCENT = basis points (500 = 5%)
  effectiveFrom DateTime
  effectiveTo   DateTime?
  product     Product @relation(fields: [productId], references: [id])
  accruals    RebateAccrual[]
  @@index([tenantId, productId])
}
model RebateAccrual {
  id           String @id @default(uuid())
  tenantId     String
  orderLineId  String
  rebateRuleId String
  amountCents  Int
  accruedAt    DateTime @default(now())
  orderLine    OrderLine @relation(fields: [orderLineId], references: [id])
  rebateRule   RebateRule @relation(fields: [rebateRuleId], references: [id])
  @@index([tenantId, accruedAt])
}

// ---------- Infra ----------
model PushSubscription {
  id          String @id @default(uuid())
  clerkUserId String
  tenantId    String?
  endpoint    String @unique
  p256dh      String
  auth        String
  createdAt   DateTime @default(now())
}
model AuditLog {
  id        String   @id @default(uuid())
  tenantId  String?
  actorId   String
  role      Role
  action    String                               // e.g. "product.update"
  entity    String
  entityId  String?
  before    Json?
  after     Json?
  ip        String?
  createdAt DateTime @default(now())
  @@index([tenantId, createdAt])
}
```

---

## 8. Row-Level Security (RLS) policies

Apply `prisma/rls.sql` after each migration (add to the deploy step). Enable RLS on every table; tenant-scoped tables filter by `app.tenant_id`; commerce/allowance/rebate tables additionally require `KICK_ADMIN` for any visibility/writes by non-owning sessions.

```sql
-- Helper expressions
-- current_setting('app.tenant_id', true)  → '' when unset
-- current_setting('app.user_role', true)
-- current_setting('app.location_id', true)

-- Generic tenant isolation (announcements example; repeat for all tenant tables)
ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_rw ON "Announcement"
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR "tenantId" = current_setting('app.tenant_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR "tenantId" = current_setting('app.tenant_id', true)::uuid
  );

-- Commerce: KICK ADMIN ONLY for writes; franchisees may READ their own catalog/orders
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_read ON "Product" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISEE_USER'
      AND "tenantId" = current_setting('app.tenant_id', true)::uuid
    )
    -- NOTE: FRANCHISOR_ADMIN intentionally absent → no read access at all
  );
CREATE POLICY product_write ON "Product" FOR ALL
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');

-- Allowance & Rebate tables: KICK ADMIN full; FRANCHISEE may read own balance only
ALTER TABLE "Allowance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY allowance_kick ON "Allowance" FOR ALL
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');
CREATE POLICY allowance_self_read ON "Allowance" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'FRANCHISEE_USER'
    AND "locationId" = current_setting('app.location_id', true)::uuid
  );

-- Orders: franchisee sees only their location; franchisor sees NONE; kick sees all
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_access ON "Order"
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISEE_USER'
      AND "locationId" = current_setting('app.location_id', true)::uuid
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISEE_USER'
      AND "locationId" = current_setting('app.location_id', true)::uuid
    )
  );
```

> **The point:** `FRANCHISOR_ADMIN` is deliberately granted **no policy** on Product/ProductVariant/Order/OrderLine/Allowance/AllowanceLedger/RebateRule/RebateAccrual/LocationOrderingRule. With RLS enabled and no matching policy, those rows are invisible and unwritable to that role — full stop.

---

## 9. Auth & RBAC

- **Clerk Organizations = franchisors.** A franchisee/franchisor user belongs to one Clerk org. Kick admins are flagged via a Clerk `publicMetadata.role = 'KICK_ADMIN'` and are not tied to one org.
- On sign-in / via Clerk webhook, **mirror** the user into `Membership` (clerkUserId, tenantId, locationId, role). RLS reads from request context derived from this, not from Clerk on every query.
- **RBAC wrapper** for route handlers:

```ts
// src/server/modules/identity/guard.ts
export function requireRole(...allowed: Role[]) {
  return async function () {
    const ctx = await getRequestContext();           // verifies Clerk session, loads Membership
    if (!allowed.includes(ctx.role)) {
      throw new HttpError(403, "Forbidden");
    }
    return ctx;
  };
}
// usage in /app/api/commerce/products/route.ts
export async function POST(req: Request) {
  const ctx = await requireRole("KICK_ADMIN")();
  // ... create product inside withTenant(ctx, ...)
}
```

Resolution order per request: verify Clerk session → load Membership → resolve tenant from host → assert membership.tenantId matches host tenant (or role is KICK_ADMIN) → build `Ctx` → `withTenant`.

---

## 10. Module specs & acceptance criteria

### 10.1 Announcements
**Behaviour:** CRUD (FRANCHISOR_ADMIN + KICK_ADMIN). Pin (sort first). Schedule via `publishAt` (status flips `SCHEDULED→PUBLISHED`). Expire via `expiresAt` (`→EXPIRED`). `requiresAck` → franchisees see an Acknowledge button; one ack per user.
**Acceptance:**
- A scheduled announcement is invisible to franchisees until `publishAt`; visible after; hidden after `expiresAt`.
- Pinned items sort above unpinned regardless of date.
- Ack is idempotent (unique on announcement+user); admin sees ack count and per-location breakdown.

### 10.2 Brand Asset Hub
**Behaviour:** upload (admin), list/download (franchisee). Download via short-lived signed R2 URL. Lifecycle `ACTIVE→ARCHIVED→DEPRECATED`; deprecated hidden from franchisees, retained for admins. New upload of same asset increments `version`.
**Acceptance:**
- Franchisee can download an ACTIVE asset; cannot see DEPRECATED ones.
- No public bucket URL is ever exposed; all downloads go through signed URLs expiring ≤5 min.

### 10.3 Tasks
**Behaviour:** admin creates task → assigns to ≥1 location with `dueAt`. Each location marks done. Overdue → reminder job. Completion stats per location.
**Acceptance:** completing one location's assignment doesn't affect others; overdue reminder fires once per overdue assignment.

### 10.4 Onboarding
**Behaviour:** templates with ordered items; per-location progress; percent complete = done/total.
**Acceptance:** marking an item updates progress; new location starts at 0%; admin sees stuck locations.

### 10.5 Ordering (Kick-controlled)
**Behaviour:** franchisee browses catalog (their tenant), constrained by `LocationOrderingRule` (min/max/cadence); cart → checkout → order history. Catalog/pricing managed only by Kick.
**Acceptance:** ordering rules enforced server-side (not just UI); franchisor role gets 403 on all commerce endpoints; price is snapshotted onto `OrderLine`.

### 10.6 Allowances — see §11.1
### 10.7 Rebates — see §11.2

### 10.8 Mobile/PWA + Push — see §15
**Acceptance:** installable on Android/iOS 16.4+; push delivered for new published announcement and overdue task; email fallback on push failure.

---

## 11. The hard parts

### 11.1 Allowance debit at checkout (concurrency-safe)
Checkout runs in **one DB transaction** with a **row lock** on the allowance to prevent double-spend from two simultaneous orders.

```
BEGIN
  -- 1. Lock the active allowance row for this location
  SELECT * FROM "Allowance"
    WHERE "locationId" = :loc AND "periodLabel" = :period
    FOR UPDATE;
  -- 2. Compute current balance = grantedCents + SUM(ledger.deltaCents)
  -- 3. order.subtotalCents known from cart (re-priced server-side, never trust client)
  -- 4. applied = min(balance, subtotal); remainder = subtotal - applied
  -- 5. If remainder > 0:
  --      (CONFIRMED default = CHARGE_CARD) create Stripe PaymentIntent for the remainder
  --      if allowance.overflow = BLOCK (rare/opt-in) → ROLLBACK, return 409 "insufficient allowance"
  -- 6. Insert Order (PENDING), OrderLines (price snapshots)
  -- 7. Insert AllowanceLedger { delta = -applied, balanceAfter = balance - applied,
  --      reason = ORDER_DEBIT, orderId }
  -- 8. If card: confirm PaymentIntent; on success set order.cardChargedCents
  -- 9. Set order.status = PAID (or PENDING until webhook confirms — see §13)
COMMIT
```

**Refunds / cancellations:** on cancel or refund, insert a **compensating** ledger entry `{ delta = +applied, reason = REFUND_CREDIT }` and set order status. Never edit prior ledger rows. Balance is always `grantedCents + SUM(deltaCents)`.

**Rules:**
- Always re-price the cart server-side from current `ProductVariant.priceCents`; ignore any client-sent totals.
- Idempotency key on checkout to prevent double submission.
- Ledger is append-only; balance is derived (you may cache `balanceAfter` for fast reads, but the sum is the source of truth).

### 11.2 Rebate accrual
On order reaching `PAID`, for each `OrderLine`:
1. Find the active `RebateRule` for the line's product where `accruedAt`/order date ∈ `[effectiveFrom, effectiveTo]`.
2. Compute: `FLAT → value * qty`; `PERCENT → round(unitPriceCents * qty * value / 10000)` (value in basis points).
3. Insert `RebateAccrual`.
**Reports:** monthly & quarterly jobs aggregate `RebateAccrual` by tenant and period → sales total + rebate total; exportable CSV/PDF. Generated by worker (§12), stored, downloadable by Kick admin.

---

## 12. Background jobs (BullMQ, worker process)

| Job | Trigger | Action |
|---|---|---|
| `announcements.publish` | cron every 1 min | flip `SCHEDULED→PUBLISHED` where `publishAt<=now`; enqueue push |
| `announcements.expire` | cron every 5 min | flip `PUBLISHED→EXPIRED` where `expiresAt<=now` |
| `tasks.overdue` | cron hourly | find overdue OPEN assignments → push + email reminder (once) |
| `rebates.report.monthly` | cron 1st of month | build prior-month report per tenant |
| `rebates.report.quarterly` | cron quarter start | build prior-quarter report per tenant |
| `push.send` | enqueued | fan-out web-push with retry/backoff; prune dead subscriptions |
| `allowance.rollover` | optional, period start | grant new period allowance per config |

Worker connects to the same DB (as `app_user`) and Redis. Jobs that touch tenant data set context explicitly (system role) or run as KICK_ADMIN context.

---

## 13. Payments (Stripe)

- Single Kick Stripe account. Franchisors never see Stripe.
- Card charges only for the **remainder** after allowance (when `overflow = CHARGE_CARD`).
- Flow: create `PaymentIntent` for remainder → confirm → mark order `PAID` on `payment_intent.succeeded` **webhook** (don't rely solely on client confirmation).
- `/api/webhooks/stripe`: verify signature with `STRIPE_WEBHOOK_SECRET`; handle `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` (→ allowance compensating credit + order status).
- Idempotent webhook handling (store processed event IDs).

---

## 14. File storage & signed downloads

- Private R2 bucket. Upload (admin) via presigned PUT; store `storageKey`.
- Download: server generates a presigned GET (TTL ≤ 5 min) after checking the asset is `ACTIVE` and belongs to the caller's tenant. Never expose the bucket publicly.
- Validate mime/size on upload; cap size; virus-scan optional later.

---

## 15. Push notifications & PWA

- `manifest.webmanifest` + service worker; installable; mobile-first layouts.
- Web Push with VAPID keys. On permission grant, POST subscription to `/api/push/subscribe` → store `PushSubscription`.
- Send via worker `push.send`. Handle 404/410 by deleting dead subscriptions. Email fallback on failure.
- iOS: requires iOS 16.4+ and the app added to home screen. If reliability is insufficient, plan a native wrapper later (out of scope v1).

---

## 16. Frontend architecture & routing

- **Subdomain → tenant** in `middleware.ts`: parse `Host`, look up tenant, rewrite with tenant context header; load `theme` and apply via CSS variables (`--primary`, etc.).
- **Three surfaces, role-gated:**
  - Franchisee app at the brand subdomain root (`/(franchisee)`).
  - `/franchisor` — FRANCHISOR_ADMIN only; **contains no commerce UI**.
  - `/admin` — KICK_ADMIN only; full control.
- shadcn/ui components; Tailwind; mobile-first. Server Components for data fetching; client components for interactivity.
- Key screens (build to these): franchisee feed, announcement detail+ack, asset grid, tasks, onboarding checklist, shop/catalog, cart, checkout (allowance balance shown), order history; franchisor dashboard (engagement stats), announcements/assets/tasks/onboarding managers; kick admin tenant manager, catalog/pricing, ordering rules, allowances, rebates, audit log.

---

## 17. API surface (representative)

All inputs validated with Zod. All handlers resolve context + `requireRole`. `[K]=KICK_ADMIN, [F]=FRANCHISOR_ADMIN, [U]=FRANCHISEE_USER`.

```
# Announcements
GET    /api/announcements                 [K,F,U]  (U/F: published+in-tenant; K: all)
POST   /api/announcements                 [K,F]
PATCH  /api/announcements/:id             [K,F]
POST   /api/announcements/:id/ack         [U]

# Assets
GET    /api/assets                        [K,F,U]
POST   /api/assets                        [K,F]    (presigned upload)
POST   /api/assets/:id/archive            [K,F]
GET    /api/assets/:id/download           [K,F,U]  (signed URL)

# Tasks
GET    /api/tasks                         [K,F,U]
POST   /api/tasks                         [K,F]
POST   /api/tasks/:id/assign              [K,F]
POST   /api/task-assignments/:id/complete [U]

# Onboarding
GET    /api/onboarding                    [K,F,U]
POST   /api/onboarding/templates          [K,F]
POST   /api/onboarding/progress           [U]

# Commerce — KICK ONLY for writes
GET    /api/commerce/products             [K]        ; [U] reads own catalog via /api/catalog
POST   /api/commerce/products             [K]
PATCH  /api/commerce/products/:id         [K]
GET    /api/catalog                       [U]        (franchisee browse)
POST   /api/orders/checkout               [U]        (allowance + stripe; §11.1)
GET    /api/orders                        [K,U]      (U: own location only)

# Allowances — KICK ONLY (U reads own balance)
GET    /api/allowances                    [K]
POST   /api/allowances                    [K]
GET    /api/allowances/me                 [U]
GET    /api/allowances/usage-report       [K]

# Rebates — KICK ONLY
POST   /api/rebates/rules                 [K]
GET    /api/rebates/reports               [K]

# Push / webhooks
POST   /api/push/subscribe                [K,F,U]
POST   /api/webhooks/stripe               (signature-verified, no session)
POST   /api/webhooks/clerk                (signature-verified)
```

**Franchisor (`[F]`) appears on NO commerce/allowance/rebate route.** That absence is the lockout at the API layer.

---

## 18. Testing strategy

- **Unit:** allowance math (debit, overflow BLOCK vs CHARGE_CARD, refund credit), rebate computation (flat + percent rounding), announcement state transitions.
- **Concurrency:** two simultaneous checkouts against one allowance never overspend (assert via parallel requests + `FOR UPDATE`).
- **`/tests/lockout` (MANDATORY, gates deploy):**
  - For every commerce/allowance/rebate endpoint, a FRANCHISOR_ADMIN token receives `403`.
  - Under a franchisor DB session, `SELECT` on Product/Order/Allowance/etc. returns **0 rows** (RLS).
  - ESLint `no-restricted-imports` test: franchisor modules importing commerce fails the build.
- **E2E (Playwright):** franchisee places an order against allowance; admin runs a rebate report; franchisor manages an announcement and verifies no shop UI exists.

---

## 19. Deployment, CI/CD, migrations

**Environments:** local (Docker: Postgres+Redis+MinIO) → preview (per-PR) → staging → production.

**CI (GitHub Actions):** install → typecheck → lint (incl. import-boundary rule) → unit tests → **lockout suite** → build → (on main) `prisma migrate deploy` via `DIRECT_URL` → apply `rls.sql` → deploy app (Vercel) + worker (Railway/Render) → smoke tests.

**Migrations:** Prisma Migrate; expand/contract pattern for zero-downtime. **Always re-apply `rls.sql` after migrate** (new tables ship RLS-disabled by default — a new table without a policy is a leak). Add a CI check that fails if any table has RLS disabled.

**Domains/TLS:** wildcard `*.portal.kickmedia.com` **plus per-tenant custom domains at launch** (CONFIRMED). Each franchisor gets `portal.<brand>.com` via Vercel Domains + automatic ACME certs. Build a small admin flow to add a custom domain, show the DNS records to set, and verify before it goes live.

**Observability:** Sentry (app + worker), PostHog events for engagement metrics, uptime check, queue-depth alert.

**Backups/DR:** managed Postgres daily backups + PITR; test a restore before launch.

---

## 20. Build order (8–12 week milestones)

Risky money + lockout first.

- **Wk 1–2 — Foundations:** repo, CI, Docker local, Clerk auth, Membership mirror, `middleware.ts` subdomain resolution, Prisma schema, **RLS + withTenant + RBAC guard + lockout ESLint rule + lockout test skeleton**, theming pipeline, PWA shell.
- **Wk 3–4 — Ordering + Allowances:** catalog, ordering rules, cart, **checkout transaction (§11.1)**, Stripe + webhooks, order history. Allowance grant/ledger/usage report.
- **Wk 5–6 — Comms:** announcements (schedule/expire/ack), asset hub (signed downloads, lifecycle), tasks, onboarding.
- **Wk 7–8 — Admin + branding:** Kick admin surfaces, franchisor surface (locked down), per-tenant branding, audit log viewer.
- **Wk 9–10 — Extras:** web push end-to-end, rebate rules + monthly/quarterly report jobs, PostHog engagement dashboards.
- **Wk 11–12 — Harden + ship:** full lockout pen-test, concurrency tests, mobile polish, staging UAT, production launch.

MVP (Phase 1 per original spec) = Wk 1–8. Phase 2 (push, rebate automation, analytics, enhanced onboarding) = Wk 9–12.

---

## 21. Open decisions to confirm (don't block — defaults chosen)

| # | Decision | CONFIRMED answer | Build impact |
|---|---|---|---|
| 1 | Scale (brands yr1–2) | **~6 franchisors** (locations TBD, small) | shared DB + RLS is comfortably enough; no sharding |
| 2 | Allowance overflow | **CHARGE CARD** for the remainder | Stripe card-charge path is now **mandatory in MVP**, not optional (§11.1, §13) |
| 3 | Allowance funding/billing | **Franchisor funds; Kick bills franchisor** | usage report per tenant is a required MVP deliverable (`/api/allowances/usage-report`) |
| 4 | Custom domains at launch | **YES** | per-tenant custom domain + ACME flow in MVP (§16, §19); +~3–5 days |
| 5 | Shopify data migration | **Yes (likely)** | in scope as a separate workstream — see §23. Needs Shopify export to scope precisely |
| 6 | Native app | **Preferred, cost-dependent** | recommend PWA in MVP, then Capacitor wrapper for App Store + Play — see §24 |
| 7 | Catalog complexity | simple variants + price; no tax engine v1 | unchanged |
| 8 | Currency | CAD | unchanged |

---

## 23. Shopify data migration (CONFIRMED: in scope)

Treat as its own workstream, runnable in parallel from ~Week 6. It can't be precisely scoped until we see a real Shopify export, so the first task is to pull one store's data and inspect it.

**What to migrate (per brand):**
- **Products & variants** → `Product` / `ProductVariant` (name, SKU, price → cents, variant options). This is the main one — Kick-controlled catalog.
- **Locations / franchisees** → `Location` (+ create Clerk org + memberships). Often these live as Shopify customers/companies or in a spreadsheet; confirm source.
- **Order history (optional)** → import as historical `Order`/`OrderLine` rows marked `FULFILLED`, for reference only (no payment/allowance side effects). Decide with Kick whether history is needed or a clean cutover is fine.

**Approach:**
1. Export via Shopify Admin (CSV) or Admin API per store.
2. Write a one-off, idempotent import script (`/scripts/migrate-shopify.ts`) that maps Shopify → Prisma, runs per tenant, and is safe to re-run (upsert by SKU/external id; store `shopifyId` on records for traceability).
3. Dry-run against staging, diff counts, spot-check, then run per brand at cutover.
4. **Do not** migrate pricing/payment config blindly — re-confirm prices with Kick since they're now Kick-controlled.

**Flag:** money fields must convert to integer cents; watch currency and tax-inclusive vs exclusive pricing in the Shopify export.

---

## 24. Mobile app strategy (CONFIRMED: app preferred, cost-dependent)

The MVP already ships a **PWA** (installable, push-capable). To get real App Store / Play Store presence at the lowest cost, wrap that same web app with **Capacitor** rather than building a separate native app.

**Recommended path — one Capacitor app, branding applied after login:**
- Reuses ~95% of the web code; the native shell loads the app and adds native push (APNs/FCM, more reliable than web push on iOS).
- Branding is applied per user after they sign in (their tenant's logo/colours), so **one** app serves all ~6 brands.
- **Cost:** Apple Developer **$99/yr**, Google Play **$25 one-time**, plus ~**1–2 weeks** of wrapping + native push + store submission. Ongoing: occasional store re-submissions on updates.

**Expensive alternative — white-label app per brand:**
- 6 separate store listings, icons, review cycles, and ongoing maintenance ×6. Only do this if each franchisor demands their own branded app in the stores. Much higher cost and overhead; **not recommended at 6 brands** unless a franchisor pays for it specifically.

**Recommendation:** ship PWA in the MVP (Wk 1–12), then add the single Capacitor app as an immediate fast-follow. This keeps the build on schedule, gets store presence cheaply, and defers per-brand apps unless someone asks (and pays) for one.

> **Decision still needed from Kick:** is one Kick-branded app (brand applied after login) acceptable, or do specific franchisors require their *own* named app in the stores? This is the cost driver.

---

## 22. Definition of done (per item)

- Inputs validated (Zod), errors typed, RLS policy exists for any new table.
- RBAC guard on every mutating route; franchisor cannot reach commerce (lockout test green).
- Money in integer cents; ledger append-only; checkout concurrency-safe.
- Mobile layout verified; push + email fallback working for the feature if it notifies.
- Audit log written for privileged actions.
- Unit + e2e tests for the feature pass in CI, including the lockout suite.

---

*Hand-off ready. Start at §20 Wk 1–2. The two places to slow down and get right: §11.1 (allowance checkout) and §5/§8/§18 (the lockout). Everything else is standard CRUD.*
