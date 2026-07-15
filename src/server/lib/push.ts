import webpush from "web-push";
import { getEnv } from "@/lib/env";
import { withTenant, systemKickContext } from "@/server/db/withTenant";
import { sendEmail } from "./email";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const env = getEnv();
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  }
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

/**
 * Sends a push notification to a single subscription. On 404/410 (dead
 * subscription) marks it DEAD for later cleanup and falls back to email if
 * a fallback address is supplied. Retries are handled by the caller via
 * BullMQ job backoff, not in-process here.
 */
export async function sendPushToSubscription(
  subscriptionId: string,
  payload: PushPayload,
  emailFallback?: { to: string; subject: string; html: string }
): Promise<{ ok: boolean; dead: boolean }> {
  ensureConfigured();
  const sub = await withTenant(systemKickContext(), (tx) => tx.pushSubscription.findUnique({ where: { id: subscriptionId } }));
  if (!sub) return { ok: false, dead: true };

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    );
    await withTenant(systemKickContext(), (tx) =>
      tx.pushSubscription.update({ where: { id: sub.id }, data: { status: "SENT", lastError: null } })
    );
    return { ok: true, dead: false };
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    const isDead = statusCode === 404 || statusCode === 410;
    await withTenant(systemKickContext(), (tx) =>
      tx.pushSubscription.update({
        where: { id: sub.id },
        data: {
          status: isDead ? "DEAD" : "FAILED",
          lastError: err instanceof Error ? err.message : String(err),
        },
      })
    );
    if (emailFallback) {
      await sendEmail(emailFallback);
    }
    return { ok: false, dead: isDead };
  }
}

export async function pruneDeadSubscriptions(): Promise<number> {
  const result = await withTenant(systemKickContext(), (tx) => tx.pushSubscription.deleteMany({ where: { status: "DEAD" } }));
  return result.count;
}
