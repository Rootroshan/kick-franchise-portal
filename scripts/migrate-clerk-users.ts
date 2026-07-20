/**
 * One-time migration: create a User row for every existing Membership.
 *
 * Clerk never exposes password hashes, so credentials cannot be carried over.
 * Each account therefore gets either an explicitly supplied password (for the
 * admins who need immediate access) or no password at all — the latter can only
 * sign in via Google or after a reset, which is the correct default rather than
 * inventing a credential nobody was told about.
 *
 * Membership.clerkUserId is REPOINTED to the new User.id. The column keeps its
 * historical name; renaming it would touch 4 models, 11 index/constraint
 * references and every RLS policy that reads app.user_id.
 *
 * Idempotent: re-running matches existing users by email and repoints rather
 * than duplicating.
 *
 * Usage:
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/migrate-clerk-users.ts
 */
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

/** Accounts that must be able to sign in immediately after the cutover. */
const INITIAL_PASSWORDS: Record<string, string> = {
  "info@voltstudios.ca": process.env.MIGRATE_PW_VOLT ?? "",
};

async function main() {
  const memberships = await prisma.membership.findMany();
  console.log(`Found ${memberships.length} memberships`);

  let created = 0;
  let repointed = 0;
  let skipped = 0;

  for (const m of memberships) {
    if (!m.email) {
      console.warn(`  SKIP ${m.clerkUserId}: no email on membership, cannot create a User`);
      skipped++;
      continue;
    }

    const email = m.email.toLowerCase();
    const initial = INITIAL_PASSWORDS[email];

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: m.displayName ?? null,
        // argon2id — see src/server/auth/password.ts for the parameter choice.
        passwordHash: initial
          ? await argon2.hash(initial, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })
          : null,
        isActive: true,
      },
      update: initial
        ? {
            passwordHash: await argon2.hash(initial, {
              type: argon2.argon2id,
              memoryCost: 19456,
              timeCost: 2,
              parallelism: 1,
            }),
          }
        : {},
    });

    if (m.clerkUserId !== user.id) {
      // Repoint every table keyed by the old Clerk id. Done in a transaction so
      // a partial repoint cannot orphan a user's notifications from their
      // membership.
      await prisma.$transaction([
        prisma.membership.updateMany({ where: { clerkUserId: m.clerkUserId }, data: { clerkUserId: user.id } }),
        prisma.notification.updateMany({ where: { clerkUserId: m.clerkUserId }, data: { clerkUserId: user.id } }),
        prisma.pushSubscription.updateMany({ where: { clerkUserId: m.clerkUserId }, data: { clerkUserId: user.id } }),
        prisma.announcementAck.updateMany({ where: { clerkUserId: m.clerkUserId }, data: { clerkUserId: user.id } }),
      ]);
      repointed++;
    }

    created++;
    console.log(
      `  ${email} → ${user.id} [${m.role}]${initial ? " (password set)" : " (no password — Google or reset only)"}`
    );
  }

  console.log(`\nDone. ${created} users, ${repointed} repointed, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
