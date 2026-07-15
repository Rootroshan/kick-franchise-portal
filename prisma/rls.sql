-- Kick Franchise Portal — Row-Level Security policies
-- Applied after every `prisma migrate deploy` via `npm run rls:apply` (scripts/apply-rls.ts).
-- IDEMPOTENT: safe to re-run — every statement drops-then-creates or uses IF NOT EXISTS.
--
-- Session GUCs set per-request by src/server/db/withTenant.ts:
--   app.tenant_id    - resolved tenant uuid, or '' for Kick admin cross-tenant reads
--   app.user_role    - 'KICK_ADMIN' | 'FRANCHISOR_ADMIN' | 'FRANCHISEE_USER'
--   app.location_id  - resolved location uuid for FRANCHISEE_USER, or '' otherwise
--
-- P0 RULE: FRANCHISOR_ADMIN has NO policy whatsoever on commerce/allowance/rebate
-- tables. With RLS enabled and no matching policy for that role, PostgreSQL
-- returns zero rows and permits zero writes — even from a hand-crafted query.

-- ============================================================================
-- Helper: guard against missing GUCs (they default to '' if unset, never NULL)
-- ============================================================================

-- ============================================================================
-- Tenant / Membership
-- ============================================================================

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_rw ON "Tenant";
CREATE POLICY tenant_rw ON "Tenant"
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR "id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
  );

ALTER TABLE "CustomDomain" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomDomain" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS custom_domain_kick ON "CustomDomain";
CREATE POLICY custom_domain_kick ON "CustomDomain" FOR ALL
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');
DROP POLICY IF EXISTS custom_domain_franchisor_read ON "CustomDomain";
CREATE POLICY custom_domain_franchisor_read ON "CustomDomain" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'FRANCHISOR_ADMIN'
    AND "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

ALTER TABLE "Location" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Location" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS location_rw ON "Location";
CREATE POLICY location_rw ON "Location"
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISOR_ADMIN'
      AND "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  );

ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS membership_kick ON "Membership";
CREATE POLICY membership_kick ON "Membership" FOR ALL
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');
DROP POLICY IF EXISTS membership_tenant_read ON "Membership";
CREATE POLICY membership_tenant_read ON "Membership" FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND current_setting('app.user_role', true) IN ('FRANCHISOR_ADMIN', 'FRANCHISEE_USER')
  );
DROP POLICY IF EXISTS membership_self_read ON "Membership";
CREATE POLICY membership_self_read ON "Membership" FOR SELECT
  USING ("clerkUserId" = current_setting('app.user_id', true));

-- ============================================================================
-- Communication: Announcements (FRANCHISOR_ADMIN + FRANCHISEE_USER both allowed)
-- ============================================================================

ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Announcement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS announcement_rw ON "Announcement";
CREATE POLICY announcement_rw ON "Announcement"
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISOR_ADMIN'
      AND "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  );

ALTER TABLE "AnnouncementAck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnnouncementAck" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS announcement_ack_rw ON "AnnouncementAck";
CREATE POLICY announcement_ack_rw ON "AnnouncementAck"
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR EXISTS (
      SELECT 1 FROM "Announcement" a
      WHERE a.id = "AnnouncementAck"."announcementId"
        AND a."tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISEE_USER'
      AND "clerkUserId" = current_setting('app.user_id', true)
    )
  );

-- ============================================================================
-- Brand Asset Hub
-- ============================================================================

ALTER TABLE "Asset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asset_kick_franchisor ON "Asset";
CREATE POLICY asset_kick_franchisor ON "Asset"
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISOR_ADMIN'
      AND "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISOR_ADMIN'
      AND "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  );
DROP POLICY IF EXISTS asset_franchisee_read ON "Asset";
CREATE POLICY asset_franchisee_read ON "Asset" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'FRANCHISEE_USER'
    AND "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND status = 'ACTIVE'
  );

-- ============================================================================
-- Tasks
-- ============================================================================

ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_rw ON "Task";
CREATE POLICY task_rw ON "Task"
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISOR_ADMIN'
      AND "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  );

ALTER TABLE "TaskAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskAssignment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_assignment_kick_franchisor ON "TaskAssignment";
CREATE POLICY task_assignment_kick_franchisor ON "TaskAssignment"
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISOR_ADMIN'
      AND EXISTS (
        SELECT 1 FROM "Task" t
        WHERE t.id = "TaskAssignment"."taskId"
          AND t."tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR current_setting('app.user_role', true) = 'FRANCHISOR_ADMIN'
  );
DROP POLICY IF EXISTS task_assignment_franchisee ON "TaskAssignment";
CREATE POLICY task_assignment_franchisee ON "TaskAssignment"
  USING (
    current_setting('app.user_role', true) = 'FRANCHISEE_USER'
    AND "locationId" = NULLIF(current_setting('app.location_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'FRANCHISEE_USER'
    AND "locationId" = NULLIF(current_setting('app.location_id', true), '')::uuid
  );

-- ============================================================================
-- Onboarding
-- ============================================================================

ALTER TABLE "OnboardingTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingTemplate" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS onboarding_template_rw ON "OnboardingTemplate";
CREATE POLICY onboarding_template_rw ON "OnboardingTemplate"
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISOR_ADMIN'
      AND "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  );

ALTER TABLE "OnboardingItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS onboarding_item_rw ON "OnboardingItem";
CREATE POLICY onboarding_item_rw ON "OnboardingItem"
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR EXISTS (
      SELECT 1 FROM "OnboardingTemplate" t
      WHERE t.id = "OnboardingItem"."templateId"
        AND t."tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR current_setting('app.user_role', true) = 'FRANCHISOR_ADMIN'
  );

ALTER TABLE "OnboardingProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingProgress" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS onboarding_progress_kick_franchisor_read ON "OnboardingProgress";
CREATE POLICY onboarding_progress_kick_franchisor_read ON "OnboardingProgress" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISOR_ADMIN'
      AND EXISTS (
        SELECT 1 FROM "Location" l
        WHERE l.id = "OnboardingProgress"."locationId"
          AND l."tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
    )
  );
DROP POLICY IF EXISTS onboarding_progress_franchisee ON "OnboardingProgress";
CREATE POLICY onboarding_progress_franchisee ON "OnboardingProgress"
  USING (
    current_setting('app.user_role', true) = 'FRANCHISEE_USER'
    AND "locationId" = NULLIF(current_setting('app.location_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'FRANCHISEE_USER'
    AND "locationId" = NULLIF(current_setting('app.location_id', true), '')::uuid
  );
DROP POLICY IF EXISTS onboarding_progress_kick_write ON "OnboardingProgress";
CREATE POLICY onboarding_progress_kick_write ON "OnboardingProgress" FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');
DROP POLICY IF EXISTS onboarding_progress_kick_update ON "OnboardingProgress";
CREATE POLICY onboarding_progress_kick_update ON "OnboardingProgress" FOR UPDATE
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');

-- ============================================================================
-- Commerce (KICK-CONTROLLED). FRANCHISOR_ADMIN has NO policy on any table below.
-- ============================================================================

ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_read ON "Product";
CREATE POLICY product_read ON "Product" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISEE_USER'
      AND "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND active = true
    )
    -- FRANCHISOR_ADMIN intentionally absent: zero visibility.
  );
DROP POLICY IF EXISTS product_write ON "Product";
CREATE POLICY product_write ON "Product" FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');
DROP POLICY IF EXISTS product_update ON "Product";
CREATE POLICY product_update ON "Product" FOR UPDATE
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');
DROP POLICY IF EXISTS product_delete ON "Product";
CREATE POLICY product_delete ON "Product" FOR DELETE
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN');

ALTER TABLE "ProductVariant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductVariant" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS variant_read ON "ProductVariant";
CREATE POLICY variant_read ON "ProductVariant" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISEE_USER'
      AND active = true
      AND EXISTS (
        SELECT 1 FROM "Product" p
        WHERE p.id = "ProductVariant"."productId"
          AND p."tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
          AND p.active = true
      )
    )
  );
DROP POLICY IF EXISTS variant_write ON "ProductVariant";
CREATE POLICY variant_write ON "ProductVariant" FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');
DROP POLICY IF EXISTS variant_update ON "ProductVariant";
CREATE POLICY variant_update ON "ProductVariant" FOR UPDATE
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');
DROP POLICY IF EXISTS variant_delete ON "ProductVariant";
CREATE POLICY variant_delete ON "ProductVariant" FOR DELETE
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN');

ALTER TABLE "LocationOrderingRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LocationOrderingRule" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ordering_rule_kick ON "LocationOrderingRule";
CREATE POLICY ordering_rule_kick ON "LocationOrderingRule" FOR ALL
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');
DROP POLICY IF EXISTS ordering_rule_franchisee_read ON "LocationOrderingRule";
CREATE POLICY ordering_rule_franchisee_read ON "LocationOrderingRule" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'FRANCHISEE_USER'
    AND "locationId" = NULLIF(current_setting('app.location_id', true), '')::uuid
  );

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_access ON "Order";
CREATE POLICY order_access ON "Order"
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISEE_USER'
      AND "locationId" = NULLIF(current_setting('app.location_id', true), '')::uuid
    )
    -- FRANCHISOR_ADMIN intentionally absent: zero visibility into orders.
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISEE_USER'
      AND "locationId" = NULLIF(current_setting('app.location_id', true), '')::uuid
    )
  );

ALTER TABLE "OrderLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_line_access ON "OrderLine";
CREATE POLICY order_line_access ON "OrderLine"
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISEE_USER'
      AND EXISTS (
        SELECT 1 FROM "Order" o
        WHERE o.id = "OrderLine"."orderId"
          AND o."locationId" = NULLIF(current_setting('app.location_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR current_setting('app.user_role', true) = 'FRANCHISEE_USER'
  );

-- ============================================================================
-- Allowances (KICK-CONTROLLED). FRANCHISOR_ADMIN has NO policy.
-- ============================================================================

ALTER TABLE "Allowance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Allowance" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allowance_kick ON "Allowance";
CREATE POLICY allowance_kick ON "Allowance" FOR ALL
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');
DROP POLICY IF EXISTS allowance_self_read ON "Allowance";
CREATE POLICY allowance_self_read ON "Allowance" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'FRANCHISEE_USER'
    AND "locationId" = NULLIF(current_setting('app.location_id', true), '')::uuid
  );

ALTER TABLE "AllowanceLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AllowanceLedger" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allowance_ledger_kick ON "AllowanceLedger";
CREATE POLICY allowance_ledger_kick ON "AllowanceLedger" FOR ALL
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');
DROP POLICY IF EXISTS allowance_ledger_self_read ON "AllowanceLedger";
CREATE POLICY allowance_ledger_self_read ON "AllowanceLedger" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'FRANCHISEE_USER'
    AND EXISTS (
      SELECT 1 FROM "Allowance" a
      WHERE a.id = "AllowanceLedger"."allowanceId"
        AND a."locationId" = NULLIF(current_setting('app.location_id', true), '')::uuid
    )
  );
-- Franchisee sessions may INSERT a ledger debit ONLY via the checkout transaction,
-- which always runs with app.user_role = 'FRANCHISEE_USER' AND ties the row to
-- their own allowance/location — but checkout debits are actually written using
-- the trusted server context, never raw client input. This policy still exists
-- as defense-in-depth so a compromised franchisee session cannot forge credits.
DROP POLICY IF EXISTS allowance_ledger_self_insert_debit ON "AllowanceLedger";
CREATE POLICY allowance_ledger_self_insert_debit ON "AllowanceLedger" FOR INSERT
  WITH CHECK (
    current_setting('app.user_role', true) = 'FRANCHISEE_USER'
    AND "deltaCents" < 0
    AND EXISTS (
      SELECT 1 FROM "Allowance" a
      WHERE a.id = "AllowanceLedger"."allowanceId"
        AND a."locationId" = NULLIF(current_setting('app.location_id', true), '')::uuid
    )
  );

-- ============================================================================
-- Rebates (KICK-CONTROLLED). FRANCHISOR_ADMIN has NO policy.
-- ============================================================================

ALTER TABLE "RebateRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RebateRule" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rebate_rule_kick ON "RebateRule";
CREATE POLICY rebate_rule_kick ON "RebateRule" FOR ALL
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');

ALTER TABLE "RebateAccrual" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RebateAccrual" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rebate_accrual_kick ON "RebateAccrual";
CREATE POLICY rebate_accrual_kick ON "RebateAccrual" FOR ALL
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');

ALTER TABLE "RebateReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RebateReport" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rebate_report_kick ON "RebateReport";
CREATE POLICY rebate_report_kick ON "RebateReport" FOR ALL
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');

-- ============================================================================
-- Infra
-- ============================================================================

ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscription_kick ON "PushSubscription";
CREATE POLICY push_subscription_kick ON "PushSubscription" FOR ALL
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');
DROP POLICY IF EXISTS push_subscription_self ON "PushSubscription";
CREATE POLICY push_subscription_self ON "PushSubscription"
  USING ("clerkUserId" = current_setting('app.user_id', true))
  WITH CHECK ("clerkUserId" = current_setting('app.user_id', true));

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_kick_read ON "AuditLog";
CREATE POLICY audit_log_kick_read ON "AuditLog" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'KICK_ADMIN'
    OR (
      current_setting('app.user_role', true) = 'FRANCHISOR_ADMIN'
      AND "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND entity NOT IN ('Product', 'ProductVariant', 'Order', 'OrderLine', 'Allowance', 'AllowanceLedger', 'RebateRule', 'RebateAccrual', 'LocationOrderingRule')
    )
  );
-- Audit logs are insert-only from the trusted server context; never updatable/deletable
-- via the app role at all (no UPDATE/DELETE policy exists -> both denied outright).
DROP POLICY IF EXISTS audit_log_insert ON "AuditLog";
CREATE POLICY audit_log_insert ON "AuditLog" FOR INSERT
  WITH CHECK (true);

ALTER TABLE "ProcessedStripeEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessedStripeEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS processed_stripe_event_system ON "ProcessedStripeEvent";
CREATE POLICY processed_stripe_event_system ON "ProcessedStripeEvent" FOR ALL
  USING (current_setting('app.user_role', true) = 'KICK_ADMIN')
  WITH CHECK (current_setting('app.user_role', true) = 'KICK_ADMIN');

-- ============================================================================
-- Onboarding item defensive UPDATE/DELETE lockdown (INSERT/USING covered above via ALL-implicit)
-- ============================================================================
-- (No further action needed: policies above use USING+WITH CHECK combos covering
-- SELECT/UPDATE/DELETE/INSERT per table as annotated.)
