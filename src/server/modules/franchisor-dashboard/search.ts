import { withTenant, type RequestContext } from "@/server/db/withTenant";

/**
 * Permitted-content search (§29). Queries ONLY: announcements, artwork,
 * tasks, onboarding templates, stores, franchisee users. NEVER products,
 * orders, payments, allowances, rebates. Tenant-scoped; RLS is the backstop.
 */
export type FranchisorSearchResults = {
  announcements: Array<{ id: string; title: string }>;
  artwork: Array<{ id: string; name: string; type: string }>;
  tasks: Array<{ id: string; title: string }>;
  onboarding: Array<{ id: string; name: string }>;
  stores: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; role: string }>;
};

export async function franchisorSearch(ctx: RequestContext, tenantId: string, q: string): Promise<FranchisorSearchResults> {
  const term = q.trim();
  const empty: FranchisorSearchResults = { announcements: [], artwork: [], tasks: [], onboarding: [], stores: [], users: [] };
  if (term.length < 2) return empty;
  const ci = { contains: term, mode: "insensitive" as const };

  return withTenant(ctx, async (tx) => {
    const [announcements, artwork, tasks, onboarding, stores, users] = await Promise.all([
      tx.announcement.findMany({ where: { tenantId, OR: [{ title: ci }, { body: ci }] }, take: 6, select: { id: true, title: true } }),
      tx.asset.findMany({ where: { tenantId, OR: [{ name: ci }, { category: ci }] }, take: 6, select: { id: true, name: true, type: true } }),
      tx.task.findMany({ where: { tenantId, OR: [{ title: ci }, { details: ci }] }, take: 6, select: { id: true, title: true } }),
      tx.onboardingTemplate.findMany({ where: { tenantId, name: ci }, take: 6, select: { id: true, name: true } }),
      tx.location.findMany({ where: { tenantId, name: ci }, take: 6, select: { id: true, name: true } }),
      tx.membership.findMany({ where: { tenantId, role: "FRANCHISEE_USER", OR: [{ displayName: ci }, { email: ci }] }, take: 6, select: { id: true, displayName: true, email: true, role: true } }),
    ]);

    return {
      announcements,
      artwork,
      tasks,
      onboarding,
      stores,
      users: users.map((u) => ({ id: u.id, name: u.displayName ?? u.email ?? "(no name)", role: u.role })),
    };
  });
}
