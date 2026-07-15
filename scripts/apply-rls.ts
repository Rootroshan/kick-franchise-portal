/**
 * Applies prisma/rls.sql using the privileged DIRECT_URL connection (table
 * owner). Must run after every `prisma migrate deploy` — new tables ship
 * with RLS disabled by default, which is a data leak until this runs.
 */
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) {
    throw new Error("DIRECT_URL is not set — cannot apply RLS policies");
  }

  const sql = readFileSync(join(process.cwd(), "prisma", "rls.sql"), "utf-8");

  const client = new Client({ connectionString: directUrl });
  await client.connect();
  try {
    await client.query(sql);
    console.log("✅ RLS policies applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Failed to apply RLS policies:", err);
  process.exit(1);
});
