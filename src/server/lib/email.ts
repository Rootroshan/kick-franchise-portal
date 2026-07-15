import { Resend } from "resend";
import { getEnv } from "@/lib/env";

let client: Resend | null = null;

function resendClient(): Resend {
  if (client) return client;
  client = new Resend(getEnv().RESEND_API_KEY);
  return client;
}

export async function sendEmail(input: { to: string; subject: string; html: string }) {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY not configured — skipping send to ${input.to}: ${input.subject}`);
    return;
  }
  await resendClient().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
