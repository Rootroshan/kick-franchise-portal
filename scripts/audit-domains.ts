/**
 * Read-only audit of every Tenant's custom domain: confirms the DB row
 * exists, checks whether it is actually attached to the Vercel project, and
 * flags a "false VERIFIED" — a domain the DB marks VERIFIED (TXT ownership
 * proved at some point) but that Vercel does not report as attached,
 * DNS-configured, or SSL-ready right now.
 *
 * Never writes. Run with `npx tsx scripts/audit-domains.ts`.
 */
import { withTenant, systemKickContext } from "@/server/db/withTenant";
import { getDomainHostingStatus, isHostingConfigured } from "@/server/modules/tenants/hostingProvider";

async function main() {
  if (!isHostingConfigured()) {
    console.error("VERCEL_API_TOKEN / VERCEL_PROJECT_ID not set — cannot check live hosting status.");
    process.exitCode = 1;
    return;
  }

  const tenants = await withTenant(systemKickContext(), (tx) =>
    tx.tenant.findMany({
      include: { customDomains: true },
      orderBy: { createdAt: "asc" },
    })
  );

  console.log(`Auditing ${tenants.length} tenant(s)...\n`);

  let flagged = 0;
  for (const tenant of tenants) {
    if (tenant.customDomains.length === 0) {
      console.log(`- ${tenant.name} (${tenant.slug}): no custom domain configured`);
      continue;
    }

    for (const domain of tenant.customDomains) {
      const live = await getDomainHostingStatus(domain.hostname);
      const isReallyActive = live.attached && live.dnsConfigured && live.sslReady;

      if (domain.status === "VERIFIED" && !isReallyActive) {
        flagged++;
        console.log(
          `⚠ ${tenant.name} — ${domain.hostname}: DB says VERIFIED but live status is NOT fully active.\n` +
            `    attached=${live.attached} dnsConfigured=${live.dnsConfigured} sslReady=${live.sslReady}` +
            (live.detail ? `\n    detail: ${live.detail}` : "")
        );
      } else if (domain.status === "VERIFIED" && isReallyActive) {
        console.log(`✓ ${tenant.name} — ${domain.hostname}: VERIFIED and confirmed live-active`);
      } else {
        console.log(`- ${tenant.name} — ${domain.hostname}: DB status ${domain.status} (not yet verified)`);
      }
    }
  }

  console.log(`\nDone. ${flagged} domain(s) flagged as false VERIFIED.`);
  if (flagged > 0) {
    console.log("Re-run each flagged domain's Verify Domain action in /admin/brands/[slug] to refresh it.");
  }
}

main()
  .catch((err) => {
    console.error("Audit failed:", err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
