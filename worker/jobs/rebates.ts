import { generateMonthlyReportsForAllTenants, generateQuarterlyReportsForAllTenants } from "@/server/modules/rebates/reports";

/** Runs on the 1st of each month: builds the prior month's report per tenant. */
export async function runMonthlyRebateReports() {
  const results = await generateMonthlyReportsForAllTenants();
  return { tenantsProcessed: results.length };
}

/** Runs at the start of each quarter: builds the prior quarter's report per tenant. */
export async function runQuarterlyRebateReports() {
  const results = await generateQuarterlyReportsForAllTenants();
  return { tenantsProcessed: results.length };
}
