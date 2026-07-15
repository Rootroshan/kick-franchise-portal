# Kick Franchise Portal — What We're Building (Plain English)

**Read this first.** It explains the project and how it works.
The full technical detail (database schema, security rules, API list) is in `Kick_Franchise_Portal_TECHNICAL_SPEC.md` — start there once this makes sense.

---

## 1. The situation

Kick Media manages **franchisor brands**. Each brand has franchisee **stores** under it.

Right now, Kick builds a **separate Shopify store for every brand**. So 6 brands = 6 Shopify stores to set up, brand, and maintain. It doesn't scale, and Shopify can't do the things Kick actually cares about — allowances, rebates, and head office keeping stores accountable.

**We're replacing all of that with one custom web app.**

---

## 2. What we're building

**One platform, many brands.**

- Kick sets up a brand in the admin → that brand instantly has its own portal.
- Each brand's portal has its own web address (`portal.brandx.com`) and its own logo and colours.
- The brand's stores log in there to read announcements, download artwork, do tasks, get onboarded, and order stock.
- Every brand's data is completely separated from every other brand's.

Ordering is **just one feature**, not the point. The portal is mainly about head office talking to stores and tracking that they've actually done things.

Scale: about **6 brands to start**, built to handle 50+.

---

## 3. The one rule that can't be broken

> **Franchisors must be technically unable to touch anything shop-related.**

Not hidden in the UI — *actually impossible*.

**Franchisors CANNOT see or touch:** products, pricing, stock, SKUs, shipping, fulfilment, payments, allowances, rebates.

**Franchisors CAN do:** announcements, artwork, onboarding, tasks, and view engagement stats.

**Kick controls all the shop stuff.** Full stop.

If you find any path where a franchisor login can reach commerce data — that's a P0 bug, drop everything.

We enforce this at **4 layers** (all detailed in the tech spec):
1. **UI** — the franchisor section has no shop screens. Nothing to click.
2. **API** — shop endpoints reject any non-Kick login with a 403.
3. **Code** — franchisor code physically can't import the commerce modules (build fails if it tries).
4. **Database** — the database itself won't return shop rows to a franchisor session, even if a bug got through.

Layer 4 is the backstop. That's what makes it real rather than a promise.

---

## 4. The three types of user

| Who | What they do |
|---|---|
| **Kick Admin** | Runs everything. All brands, the catalogue, pricing, allowances, rebates. |
| **Franchisor Admin** | Head office for ONE brand. Posts announcements, uploads artwork, sets tasks, builds onboarding, views stats. **No shop access.** |
| **Franchisee User** | A store. Reads posts, downloads artwork, does tasks, places orders, sees their own balance and order history. |

A franchisee only ever sees **their own store's** data — not other stores in the same brand.

---

## 5. The features and how each one works

### Announcements
Head office posts an update to their stores.
- **Pin** it to keep it at the top.
- **Schedule** it — set it to go live at 9am Monday, and it publishes itself.
- **Auto-expire** — set an end date and it disappears.
- **Require acknowledgement** — store taps "Got it", and head office sees exactly who has and hasn't read it.
- **When it publishes, every store in that brand gets a push notification on their phone.** This is a specific client ask — it matters.

### Artwork Hub
A download library: logos, signage, menu boards, campaign art.
- **Download only.** Stores can't upload or edit.
- Searchable, sorted by category.
- Old files get **archived** or marked out-of-date — hidden from stores, kept for admins.
- Re-uploading a file makes a **new version** and replaces the old one.
- Files are private. Downloads use temporary secure links that expire (~5 mins). Never a public URL.

### Tasks
Head office assigns jobs to stores.
- Create a task → assign it to one or more stores → set a due date.
- Each store marks it done separately. One store finishing doesn't affect another.
- Overdue tasks trigger an automatic reminder (push + email), **once**.

### Onboarding
A checklist for new stores.
- Ordered list of steps, with a progress bar.
- Admins can see which stores are stuck.

### Ordering (Kick controls this)
Stores order stock.
- **Kick** creates and prices the catalogue — per brand.
- **Ordering rules per store:** which products they're allowed, min/max quantities, how often they can order. Enforced on the server, not just hidden in the UI.
- Browse → cart → checkout → order history.
- Always **re-price the cart on the server**. Never trust a total sent from the browser.

### Allowances (the important one — see §6)
Kick gives a store a dollar budget. It gets used up automatically as they order.

### Rebates
- Kick sets a rebate per product — either a **flat dollar amount** or a **percentage**.
- Each rebate has effective dates (start, optional end).
- When an order is paid, the system works out the rebate on each line and records it automatically. No manual tracking.

### Sales & Rebate Analytics
- Dashboard: sales totals and rebate totals per brand.
- **Automatic monthly and quarterly reports.**
- Broken down by product and by store.
- Exportable to CSV / PDF — Kick uses these for billing and accounting.

### Mobile-first + Push
- Every screen designed for **phones first**. Works on desktop too.
- It's a **PWA** — installs to the home screen like an app, which is what enables push.
- Push for: new announcements, overdue task reminders, onboarding nudges.
- **Email fallback** if a push fails to deliver.
- Note: push works well on Android. On iPhone it needs iOS 16.4+ **and** the user must add the app to their home screen. Real native apps are Phase 2.

---

## 6. The allowance system — read this twice

This is real money. It's the most important thing to get right.

**How it works:**
1. Kick assigns a store a dollar allowance for a period (e.g. $500 for Q3).
2. The store shops normally. Their **balance is visible the whole time**.
3. At checkout, the allowance is used **first**.
4. **If the order costs more than the balance is left, the difference is charged to their card.** (Confirmed with the client — this is the default behaviour.)

**Example:** balance is $100, order is $120 → $100 comes off the allowance, $20 goes on the card.

**The rules you must follow:**

- **The ledger is append-only.** Never edit or delete a ledger row. Every change (grant, order, refund, adjustment) is a *new* row. The balance is calculated by adding them all up. This is what makes it auditable.
- **Refunds/cancellations** = add a new **positive** ledger row to give the credit back. Never reverse the old row.
- **Lock the row during checkout.** If a store submits two orders at the same moment, they must not both spend the same balance. Use a database row lock (`SELECT ... FOR UPDATE`) inside one transaction. Test this with parallel requests.
- **All money is stored in integer cents.** Never floats. `$12.50` is `1250`.
- **Idempotency key on checkout** so a double-click doesn't create two orders.

**Usage reports:** Kick needs a report of allowance usage per brand — because **franchisors fund the allowances and Kick bills them for it.** That report is a required deliverable, not a nice-to-have.

---

## 7. How a store actually uses it (the main flow)

1. Store opens `portal.brandx.com` on their phone → sees their brand's logo and colours.
2. Logs in → lands on a feed: pinned announcements, anything needing acknowledgement, quick links.
3. Gets a push: *"New announcement from BrandX"* → taps it → reads → taps **Acknowledge**.
4. Goes to **Shop** → sees only what their store is allowed to order → adds to cart.
5. Balance shows **$100 left**. Cart is **$120**.
6. Checks out → $100 comes off the allowance, **$20 charged to their card**.
7. Order confirmed. Balance now $0. Order appears in their history.
8. Behind the scenes: ledger row written, rebates calculated and recorded for Kick's reports.

---

## 8. The tech stack

All TypeScript. Nothing exotic.

| Part | Tool |
|---|---|
| App (front + back) | **Next.js 14+** (App Router) + React |
| Styling | Tailwind + shadcn/ui |
| Database | **PostgreSQL** (Neon or Supabase) |
| DB access | **Prisma** |
| Logins & roles | **Clerk** (Organizations = brands) |
| File storage | **Cloudflare R2** (private, signed URLs) |
| Background jobs | **BullMQ + Redis** (Upstash) — separate worker |
| Payments | **Stripe** (Kick's single account) |
| Email | Resend |
| Push | Web Push (VAPID) |
| Errors / stats | Sentry / PostHog |
| Hosting | Vercel (app) + Railway or Render (worker) |

**Two critical setup details** (both in the tech spec, both easy to get wrong):
- The app must connect to Postgres as a **non-superuser role**. If it connects as the owner, the database security rules are silently ignored and the whole lockout is worthless.
- **Every new table needs a security policy.** A new table without one is a leak. There's a CI check for this — keep it green.

---

## 9. Background jobs

A separate worker process handles anything scheduled:
- Publish scheduled announcements (checks every minute) → then fires the push.
- Expire announcements past their end date.
- Overdue task reminders (hourly).
- Monthly + quarterly rebate/sales reports.
- Sending pushes, with retries. Delete dead subscriptions.

---

## 10. Build order — do the risky stuff first

**Don't build this in feature order. Build it in risk order.** Most of it is standard CRUD you'll fly through. Two things bite if left late.

| Weeks | What |
|---|---|
| **1–2** | Foundations: logins, roles, multi-brand setup, database, **and the lockout built into the structure from day one** (all 4 layers + the tests). |
| **3–4** | **Ordering + allowances.** The checkout transaction, card charging, refunds, the concurrency lock. The scariest part — do it early. |
| **5–6** | Announcements, artwork hub, tasks, onboarding. |
| **7–8** | Admin screens (Kick full, franchisor locked down), per-brand branding. |
| **9–10** | Push notifications, rebate rules, sales/rebate reports and analytics. |
| **11–12** | Hammer the lockout, concurrency tests, mobile polish, launch. |

Target: **8–12 weeks.**

---

## 11. What's NOT in this build

- **Native iOS/Android apps** → Phase 2. (PWA only for now.)
- **Enhanced onboarding** (conditional steps, sign-offs) → Phase 2.
- **Shopify data migration** → separate task, scoped once we see a real export. Likely needed eventually.

---

## 12. Testing — non-negotiable

Two suites that must pass before anything ships:

1. **The lockout suite.** For every shop/allowance/rebate endpoint, prove a franchisor login gets a **403**. And prove that at the database level, a franchisor session returns **zero rows** from those tables. This gates deployment.
2. **The money suite.** Allowance maths, the card overflow, refunds, and **two simultaneous checkouts against one balance never overspending**.

Plus normal e2e: store places an order, admin runs a rebate report, franchisor manages an announcement and has no shop UI anywhere.

---

## 13. Decisions already confirmed with the client

| Question | Answer |
|---|---|
| How many brands? | ~6 to start, build for 50+ |
| Allowance runs out? | **Charge the card** for the remainder |
| Who funds allowances? | Franchisor funds, Kick bills them → usage report required |
| Custom domains at launch? | **Yes** — every brand gets its own |
| Shopify migration? | Probably, but scoped separately |
| Native app? | **Phase 2** |
| Currency | CAD |

---

## 14. If you only remember three things

1. **Franchisors can never reach the shop.** Build it into the foundation in week 1, test it hard, treat any leak as P0.
2. **The allowance ledger is append-only, money is in cents, and checkout locks the row.** It's real money — no shortcuts.
3. **Build risky first.** Allowances and the lockout in weeks 1–4. The rest is easy.

**Next:** read `Kick_Franchise_Portal_TECHNICAL_SPEC.md` — the database schema, security policies, and API list are all there, ready to build from.
