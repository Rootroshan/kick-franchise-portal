# Kick Franchise Portal

Multi-tenant franchise platform. Three isolated portals share one Postgres database with Row-Level Security:

- **Super Admin** (`/admin`) — Kick Media staff (`KICK_ADMIN`), cross-tenant, full commerce control.
- **Franchisor** (`/franchisor`) — brand head office (`FRANCHISOR_ADMIN`), brand communication & engagement only. **No commerce access, enforced at four layers.**
- **Franchisee** (`/`) — store operators (`FRANCHISEE_USER`), own store only.

## Local development

```bash
# Postgres: db kick_dev, app role kick_app_dev (non-superuser, RLS-enforced)
npm run seed:dev            # seeds "Maple Grove Coffee" + stores/announcements/tasks/onboarding/acks/downloads
PORT=4100 npm run dev       # dev server on http://localhost:4100
```

Auth is bypassed locally via `DEV_BYPASS_AUTH=true` in `.env.local` (see `src/lib/devBypass.ts`; never active in a deployed build). Switch the viewed role:

```
DEV_BYPASS_ROLE=KICK_ADMIN        # → /admin
DEV_BYPASS_ROLE=FRANCHISOR_ADMIN  # → /franchisor/dashboard  (needs DEV_BYPASS_TENANT_ID)
DEV_BYPASS_ROLE=FRANCHISEE_USER   # → /                       (needs TENANT_ID + LOCATION_ID)
```

## Testing

```bash
node --env-file=.env.test node_modules/.bin/vitest run   # 80 tests; config forces single-threaded (shared test DB)
```

Test DB: `kick_test` / role `kick_app_test`. `vitest.config.mts` sets `fileParallelism: false` because the integration tests share one real Postgres and reset it between tests.

## Franchisor Dashboard (`/franchisor/dashboard`)

Live, tenant-scoped, **commerce-free** engagement dashboard. Data flows:

```
repository.ts (aggregate SQL)  →  service.ts (assemble)  →  page.tsx (RSC)  →  components/franchisor/dashboard/*
```

Module: `src/server/modules/franchisor-dashboard/` — `repository.ts`, `service.ts`, `calculations.ts` (pure, unit-tested), `dateRange.ts`, `permissions.ts`, `types.ts`, `search.ts`, `stores.ts`, `badge.ts`.

### Engagement calculations (documented per spec §15/§16)

- **safePercent(n, d)** — `round(min(100, max(0, n/d*100)))`; returns **0 when d ≤ 0** (never NaN/Infinity).
- **Announcements Read** — acknowledgements ÷ (required announcements published in range × active stores).
- **Tasks Completed** — completed task assignments ÷ total task assignments.
- **Onboarding Progress** — completed onboarding progress rows ÷ total onboarding progress rows.
- **Artwork Downloads** — count of `asset.download` audit-log rows in the selected range.
- **Overall Engagement** — the **mean of the *available* component percentages** (Announcements Read, Tasks Completed, Onboarding Progress, Artwork Engagement). A component is "available" only when its denominator was > 0, so empty categories don't drag the score to zero.
- **Trends** — each KPI compares the selected range with the immediately-preceding equal-length window (`dateRange.ts`).
- **Overdue task** — assignment status is not `COMPLETED` and `dueAt` is in the past.

### Four-layer commerce lockout (spec §5)

The `FRANCHISOR_ADMIN` role is **technically unable** to reach commerce data:

1. **UI** — `franchisorNav.ts` has no Catalogue/Orders/Payments/Allowances/Rebates entries; search (`search.ts`) queries only permitted tables.
2. **API / role** — `requireRole`/`requireTenantRole` + `assertFranchisor` reject non-franchisors; commerce route handlers `requireRole("KICK_ADMIN")` → 403.
3. **Module boundary** — `.eslintrc.json` `no-restricted-imports` bans importing `commerce`/`allowances`/`rebates` from any franchisor path (now including `server/modules/franchisor-dashboard/**`). Build fails on violation.
4. **Postgres RLS** — `Product`, `Order`, `Allowance`, `RebateRule`, etc. policies grant SELECT only to `KICK_ADMIN` (or `FRANCHISEE_USER` for own-store products). A franchisor session returns **zero rows**.

Covered by `tests/lockout/*` and `tests/integration/franchisor-dashboard.test.ts`.

## Implementation Assumptions

Made while building the Franchisor Dashboard, where the spec left a detail open (per the "make the safest professional assumption and continue" directive):

- **Artwork downloads have no dedicated table.** They're derived from `AuditLog` rows with `action = "asset.download"` (the audit log is the existing activity source, and §22 lists "Artwork downloaded" as an activity). Until such rows exist the KPI reads 0. The dev seed inserts a couple so the KPI demonstrates a real number.
- **Nav path `/franchisor/artwork`** (spec §3) redirects to the pre-existing `/franchisor/assets` implementation rather than duplicating it, so both paths resolve and existing functionality is preserved.
- **"Artwork Engagement" donut component** = downloads ÷ active stores (capped 100), since there is no per-store artwork acknowledgement concept — downloads-per-store is the closest permitted signal.
- **Onboarding "stalled"** = a template with incomplete stores and no progress `doneAt` in the last **14 days** (configurable in `repository.ts`).
- **Brand logo** is read from `Tenant.theme.logoUrl`; absent → a Lucide `Building2` placeholder (no broken image, no raster asset).
- **KICK_ADMIN impersonation** of the franchisor portal (spec §4) is **not** enabled — Kick admins are redirected to `/admin`. Enabling it is an explicit, audited feature to add later; the dashboard service gates on `FRANCHISOR_ADMIN` only.
- **First-name greeting** comes from the caller's `Membership.displayName` (falling back to the email local-part), since the request context carries only IDs.
- **Notifications** are computed live from dashboard signals (overdue tasks, unread announcements, stalled onboarding, failed push) rather than a persisted per-user notification table; read/unread state is not yet persisted.

### Franchisor CRUD tabs (Announcements / Artwork / Tasks / Onboarding / Stores / Analytics / Settings)

- **Artwork uploads are Kick-managed.** The earlier product rule ("artwork is uploaded by Kick, not the franchisor") is kept: the asset write routes (`/api/assets/upload-url`, `POST /api/assets`, `/api/assets/[id]/archive`) remain `[K]` (KICK_ADMIN-only), so a franchisor cannot upload/replace/archive. The franchisor Artwork Hub is therefore **view + download** only, and `/franchisor/artwork/upload` explains this. To allow franchisor uploads instead, relax those three routes to `[K,F]` and add an upload form calling `/api/assets/upload-url` — one-line change per route. This directly conflicts with the newest spec's §9 (which implies franchisor uploads); the Kick-only reading was chosen because it is the safer, higher-privilege-restricting interpretation and matches the standing P0 lockout.
- **Artwork downloads** are served by `GET /api/franchisor/assets/[id]/download`, which mints a 5-minute signed R2 URL and records an `asset.download` audit row (feeding the dashboard's Artwork KPI). **Live R2 credentials are required** for the signed URL to resolve — set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` (see `.env.example`). Without them the route returns an error at download time; everything else works locally.
- **Onboarding step metadata**: the `OnboardingItem` model has `title` + `order` only. The spec's richer step fields (description, required/optional, responsible role, estimated time, file/link) are **not** in the schema and were not added mid-task to avoid a migration; the step editor manages title + order. Adding those columns is a follow-up migration.
- **Task priority**: `Task` has no `priority` column, so the priority filter/field from the spec is omitted rather than faked. Follow-up migration if needed.
- **Brand settings are read-only for franchisors.** Postgres RLS on `Tenant` has `WITH CHECK (user_role = 'KICK_ADMIN')`, so a franchisor session **cannot** write the tenant row — verified by an integration test. The Settings → Brand tab therefore displays brand/contact/timezone read-only and directs changes to Kick, satisfying §16 ("cannot modify Kick-controlled settings"). `updateBrand` exists in the service but is intentionally not wired to a form.
- **Notification preferences** (Settings → Notifications) are UI toggles only — there is no per-user preferences table yet, so selections are not persisted. Documented in-UI.
- **Announcement scheduling/expiry** relies on the existing worker to flip SCHEDULED→PUBLISHED→EXPIRED; the franchisor "Expire now" action sets status immediately. Draft-only deletion is enforced (published announcements are expired, not deleted).
- **Reusable UI**: the franchisor tabs reuse the generic, commerce-free `src/components/admin/kit.tsx` primitives (PageHeader, KPIStatCard, StatusBadge, EmptyState, ErrorState, Pagination) and `DataTable`/`ListToolbar`, plus franchisor-specific `FilterTabs`, `CategoryChips`, and per-domain forms. These admin-kit files import nothing from any commerce module (kept clean so the import boundary holds).

### Franchisee Store Portal (audit + completion)

The store portal (route group `app/(franchisee)/`, root-level paths — `/`, `/shop`, `/cart`, `/checkout`, `/orders`, `/tasks`, `/onboarding`, `/assets`, `/announcements`) **already existed** with a solid core and backend: the checkout uses `SELECT … FOR UPDATE` allowance locking + a unique idempotency key + allowance-first-then-Stripe-remainder + an append-only ledger; 25 FRANCHISEE_USER RLS policies scope every table; a service worker (`public/sw.js`) and push-subscribe API were present. This task **audited** it, **preserved** all of that, and **completed** the missing pieces without duplicating routes:

- **Added leaf/detail pages** (all scoped to the caller's own location so URL-id tampering can't cross stores — proven by `tests/integration/store-portal-isolation.test.ts`): `/orders/[orderId]`, `/tasks/[assignmentId]` (+ complete server action), `/shop/[productId]` (variants + add-to-cart), `/announcements` (list; detail already existed), `/artwork` (redirects to the existing `/assets` grid, which already does signed 5-min downloads).
- **Added account pages**: `/allowances` (read-only balance + append-only ledger history), `/notifications` (live store-scoped feed), `/profile` (role/brand/store + quick links), `/settings` (push opt-in + preference toggles + password-via-Clerk). `/checkout/success` confirmation; CheckoutFlow now returns here.
- **PWA**: added `app/manifest.ts` → `/manifest.webmanifest` (the layout already referenced it but the file was missing) with a maskable SVG app icon at `public/icons/icon.svg`; added `POST /api/push/unsubscribe` (mirrors subscribe, scoped to the caller's own subscription).

Franchisee Implementation Assumptions:

- **Store notifications are derived, not persisted.** There is no per-user notification table, so `/notifications` computes the feed live from the store's own unacknowledged announcements, due/overdue tasks, and recent orders. Read/unread state is therefore not stored; "mark read / mark all read" is a follow-up once a `Notification` table exists. Same for the Settings notification-preference toggles (UI-only).
- **Routing convention preserved.** The portal lives at root paths under the `(franchisee)` route group (a brand subdomain rewrites `/` to it), not under `/store`. The spec's `/store/*` paths were **not** created — that would have duplicated working routes. `/artwork` aliases the existing `/assets` implementation rather than duplicating the grid.
- **PWA icon** is a single maskable SVG (installable, scalable). Per-brand raster icons (192/512 PNG) are a follow-up; no binary icon assets were fabricated.
- **Product/order detail images**: products have no image column in the schema, so detail pages show a Lucide `Package` placeholder rather than a fabricated image. Follow-up migration if product imagery is added.
- **Checkout, allowance, ledger, RLS, and the service worker were left untouched** — they already satisfy §16/§17/§23. Only the `return_url`/success redirects in `CheckoutFlow` were repointed to the new `/checkout/success` page.
- **Local shop data**: the dev seed (`npm run seed:dev`) creates the catalogue; if the shop looks empty locally, re-run the seed (it is idempotent). The DB had been reset during development, which is why products briefly showed zero until re-seeded.
