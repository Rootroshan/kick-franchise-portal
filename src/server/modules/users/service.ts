import type { Role } from "@prisma/client";
import { authPrisma } from "@/server/db/authClient";
import { withTenant } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import type { RequestContext } from "@/server/db/withTenant";

/**
 * Admin user management.
 *
 * Identity lives in two tables: `User` holds credentials and account state,
 * `Membership` holds role plus brand/store scope, joined on
 * Membership.clerkUserId = User.id (the column name is historical — see the
 * schema note). Neither is reachable through withTenant(): `User` carries a
 * deny-all RLS policy, so reads and writes here go through authPrisma, while
 * audit entries still go through withTenant() so they land under RLS.
 *
 * Every exported mutation takes the caller's RequestContext and is only ever
 * invoked behind requireRole("KICK_ADMIN") in the server actions.
 */

export type UserRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  role: Role | null;
  tenantId: string | null;
  tenantName: string | null;
  locationId: string | null;
  locationName: string | null;
  hasPassword: boolean;
};

export type UserListQuery = {
  search?: string;
  role?: string;
  status?: string;
  brand?: string;
  page: number;
  limit: number;
};

export type UserKpis = { total: number; active: number; inactive: number; superAdmins: number };

/** Users plus their membership scope, filtered and paginated. */
export async function listUsers(
  _ctx: RequestContext,
  q: UserListQuery
): Promise<{ rows: UserRow[]; total: number }> {
  const search = q.search?.trim();

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }
  if (q.status === "active") where.isActive = true;
  if (q.status === "inactive") where.isActive = false;

  // Role and brand live on Membership, not User, so they cannot be expressed in
  // the User `where`. Narrow to the matching user ids first, then filter.
  let idFilter: string[] | null = null;
  if (q.role || q.brand) {
    const memberships = await withTenant(_ctx, (tx) =>
      tx.membership.findMany({
        where: {
          ...(q.role ? { role: q.role as Role } : {}),
          ...(q.brand ? { tenantId: q.brand } : {}),
        },
        select: { clerkUserId: true },
      })
    );
    idFilter = memberships.map((m) => m.clerkUserId);
    // No membership matched — short-circuit rather than issuing `id IN ()`.
    if (idFilter.length === 0) return { rows: [], total: 0 };
    where.id = { in: idFilter };
  }

  const [users, total] = await Promise.all([
    authPrisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    authPrisma.user.count({ where }),
  ]);

  const rows = await attachMemberships(_ctx, users);
  return { rows, total };
}

/** Joins each user to their membership (role + brand/store names). */
async function attachMemberships(
  ctx: RequestContext,
  users: Array<{
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    passwordHash: string | null;
  }>
): Promise<UserRow[]> {
  if (users.length === 0) return [];

  const memberships = await withTenant(ctx, (tx) =>
    tx.membership.findMany({
      where: { clerkUserId: { in: users.map((u) => u.id) } },
      include: { tenant: { select: { name: true } }, location: { select: { name: true } } },
    })
  );

  // A user may hold several memberships (one per tenant plus a platform-wide
  // KICK_ADMIN row). Prefer the KICK_ADMIN one so the table shows the highest
  // privilege rather than an arbitrary tenant membership.
  const byUser = new Map<string, (typeof memberships)[number]>();
  for (const m of memberships) {
    const existing = byUser.get(m.clerkUserId);
    if (!existing || (m.role === "KICK_ADMIN" && m.tenantId === null)) byUser.set(m.clerkUserId, m);
  }

  return users.map((u) => {
    const m = byUser.get(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      role: m?.role ?? null,
      tenantId: m?.tenantId ?? null,
      tenantName: m?.tenant?.name ?? null,
      locationId: m?.locationId ?? null,
      locationName: m?.location?.name ?? null,
      hasPassword: u.passwordHash !== null,
    };
  });
}

export async function getUserKpis(ctx: RequestContext): Promise<UserKpis> {
  const [total, active, superAdmins] = await Promise.all([
    authPrisma.user.count(),
    authPrisma.user.count({ where: { isActive: true } }),
    withTenant(ctx, (tx) => tx.membership.count({ where: { role: "KICK_ADMIN", tenantId: null } })),
  ]);
  return { total, active, inactive: total - active, superAdmins };
}

export async function getUserById(ctx: RequestContext, id: string): Promise<UserRow | null> {
  const user = await authPrisma.user.findUnique({ where: { id } });
  if (!user) return null;
  const [row] = await attachMemberships(ctx, [user]);
  return row ?? null;
}

export type CreateUserInput = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
  isActive: boolean;
  tenantId?: string | null;
  locationId?: string | null;
};

/**
 * Creates a user and their membership.
 *
 * KICK_ADMIN memberships are always platform-wide (tenantId null) — that is
 * what requestContext.ts checks for, so a tenant-scoped KICK_ADMIN row would
 * silently confer nothing.
 */
export async function createUser(ctx: RequestContext, input: CreateUserInput): Promise<{ id: string }> {
  const email = input.email.trim().toLowerCase();

  const strengthError = validatePasswordStrength(input.password);
  if (strengthError) throw new Error(strengthError);

  const existing = await authPrisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with that email already exists.");

  const user = await authPrisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      phone: input.phone?.trim() || null,
      passwordHash: await hashPassword(input.password),
      isActive: input.isActive,
    },
  });

  const tenantId = input.role === "KICK_ADMIN" ? null : (input.tenantId ?? null);

  await withTenant(ctx, async (tx) => {
    await tx.membership.create({
      data: {
        clerkUserId: user.id,
        tenantId,
        locationId: input.role === "KICK_ADMIN" ? null : (input.locationId ?? null),
        role: input.role,
        displayName: input.name.trim(),
        email,
      },
    });
    await writeAuditLog(tx, {
      tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "user.create",
      entity: "User",
      entityId: user.id,
      // Never record the password or its hash — an audit log is widely
      // readable and is the wrong place to duplicate a credential.
      after: { email, role: input.role, isActive: input.isActive },
    });
  });

  return { id: user.id };
}

export type UpdateUserInput = {
  name?: string;
  email?: string;
  phone?: string | null;
  role?: Role;
  isActive?: boolean;
  tenantId?: string | null;
  locationId?: string | null;
};

/**
 * Updates a user and their membership together.
 *
 * Self-protection is enforced here rather than in the UI, because this is
 * where the caller's identity is authoritative: an admin may not strip their
 * own KICK_ADMIN role or deactivate themselves, either of which could leave
 * the platform with no reachable administrator.
 *
 * Role/tenant/location are re-derived server-side — a FRANCHISEE_USER always
 * needs an active store, and a KICK_ADMIN is always platform-wide, regardless
 * of what the client submitted.
 */
export async function updateUser(ctx: RequestContext, id: string, input: UpdateUserInput): Promise<void> {
  const before = await getUserById(ctx, id);
  if (!before) throw new Error("User not found.");

  const isSelf = id === ctx.userId;
  if (isSelf && input.role !== undefined && input.role !== "KICK_ADMIN" && before.role === "KICK_ADMIN") {
    throw new Error("You cannot remove your own Super Admin role.");
  }
  if (isSelf && input.isActive === false) {
    throw new Error("You cannot deactivate your own account.");
  }

  const nextRole = input.role ?? before.role ?? "FRANCHISEE_USER";

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (email !== before.email) {
      const clash = await authPrisma.user.findUnique({ where: { email } });
      if (clash) throw new Error("An account with that email already exists.");
    }
  }

  // A franchisee without an active store cannot sign in (see
  // loginValidation.ts), so refuse to save a state that locks them out.
  if (nextRole === "FRANCHISEE_USER") {
    const locationId = input.locationId ?? before.locationId;
    if (!locationId) throw new Error("Franchisee users must be assigned to a store.");

    const location = await withTenant(ctx, (tx) => tx.location.findUnique({ where: { id: locationId } }));
    if (!location) throw new Error("That store no longer exists.");
    if (location.status !== "active") throw new Error("That store is not active.");
  }

  await authPrisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  // Deactivating must end live sessions, or the user keeps working until their
  // JWT expires.
  if (input.isActive === false) await authPrisma.session.deleteMany({ where: { userId: id } });

  await withTenant(ctx, async (tx) => {
    if (input.role !== undefined || input.tenantId !== undefined || input.locationId !== undefined) {
      const role = input.role ?? before.role ?? "FRANCHISEE_USER";
      const tenantId = role === "KICK_ADMIN" ? null : (input.tenantId ?? before.tenantId);

      // Replace rather than update: the membership's unique key is
      // (clerkUserId, tenantId), so a tenant change is a different row.
      await tx.membership.deleteMany({ where: { clerkUserId: id } });
      await tx.membership.create({
        data: {
          clerkUserId: id,
          tenantId,
          locationId: role === "KICK_ADMIN" ? null : (input.locationId ?? before.locationId),
          role,
          displayName: input.name?.trim() ?? before.name,
          email: before.email,
        },
      });
    }

    await writeAuditLog(tx, {
      tenantId: before.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: input.role !== undefined ? "user.access_change" : "user.update",
      entity: "User",
      entityId: id,
      // Full before/after of every editable field, so an access change can be
      // reconstructed later. Credentials are never included.
      before: {
        name: before.name,
        email: before.email,
        phone: before.phone,
        role: before.role,
        isActive: before.isActive,
        tenantId: before.tenantId,
        locationId: before.locationId,
      },
      after: {
        name: input.name ?? before.name,
        email: input.email ?? before.email,
        phone: input.phone !== undefined ? input.phone : before.phone,
        role: input.role ?? before.role,
        isActive: input.isActive ?? before.isActive,
        tenantId: input.tenantId !== undefined ? input.tenantId : before.tenantId,
        locationId: input.locationId !== undefined ? input.locationId : before.locationId,
      },
    });
  });
}

/** Activates or deactivates an account. A caller may never deactivate themself. */
export async function setUserActive(ctx: RequestContext, id: string, isActive: boolean): Promise<void> {
  if (id === ctx.userId && !isActive) {
    throw new Error("You cannot deactivate your own account.");
  }

  const before = await getUserById(ctx, id);
  if (!before) throw new Error("User not found.");

  await authPrisma.user.update({ where: { id }, data: { isActive } });

  // Deactivation must also end any live session, or the user keeps working
  // until their JWT expires. Sessions are DB-backed for OAuth accounts.
  if (!isActive) await authPrisma.session.deleteMany({ where: { userId: id } });

  await withTenant(ctx, (tx) =>
    writeAuditLog(tx, {
      tenantId: before.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: isActive ? "user.activate" : "user.deactivate",
      entity: "User",
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive },
    })
  );
}

/** Sets a new password directly (admin-initiated reset). */
export async function resetUserPassword(ctx: RequestContext, id: string, newPassword: string): Promise<void> {
  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) throw new Error(strengthError);

  const before = await getUserById(ctx, id);
  if (!before) throw new Error("User not found.");

  await authPrisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(newPassword) } });
  // Force re-authentication everywhere with the new credential.
  await authPrisma.session.deleteMany({ where: { userId: id } });

  await withTenant(ctx, (tx) =>
    writeAuditLog(tx, {
      tenantId: before.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "user.password_reset",
      entity: "User",
      entityId: id,
      // Records that a reset happened, never the value.
      after: { email: before.email },
    })
  );
}

/** Deletes a user. A caller may never delete themself. */
export async function deleteUser(ctx: RequestContext, id: string): Promise<void> {
  if (id === ctx.userId) throw new Error("You cannot delete your own account.");

  const before = await getUserById(ctx, id);
  if (!before) throw new Error("User not found.");

  await withTenant(ctx, async (tx) => {
    await tx.membership.deleteMany({ where: { clerkUserId: id } });
    await writeAuditLog(tx, {
      tenantId: before.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "user.delete",
      entity: "User",
      entityId: id,
      before: { email: before.email, name: before.name, role: before.role },
    });
  });

  // Account/Session rows cascade from the User relation.
  await authPrisma.user.delete({ where: { id } });
}
