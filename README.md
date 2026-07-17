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
