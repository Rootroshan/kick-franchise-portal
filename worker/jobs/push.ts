import { pruneDeadSubscriptions } from "@/server/lib/push";

/** Runs periodically: removes PushSubscription rows marked DEAD after a 404/410 send failure. */
export async function cleanupDeadSubscriptions() {
  const count = await pruneDeadSubscriptions();
  return { removed: count };
}
