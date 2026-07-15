import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional().default(""),
  CLERK_SECRET_KEY: z.string().optional().default(""),
  CLERK_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional().default(""),
  R2_ACCOUNT_ID: z.string().optional().default(""),
  R2_ACCESS_KEY_ID: z.string().optional().default(""),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(""),
  R2_BUCKET: z.string().optional().default("kick-assets"),
  R2_ENDPOINT: z.string().optional().default(""),
  REDIS_URL: z.string().optional().default("redis://localhost:6379"),
  RESEND_API_KEY: z.string().optional().default(""),
  RESEND_FROM_EMAIL: z.string().optional().default("Kick Portal <notifications@portal.kickmedia.com>"),
  VAPID_PUBLIC_KEY: z.string().optional().default(""),
  VAPID_PRIVATE_KEY: z.string().optional().default(""),
  VAPID_SUBJECT: z.string().optional().default("mailto:ops@kickmedia.com"),
  APP_BASE_DOMAIN: z.string().min(1).default("portal.kickmedia.com"),
  SENTRY_DSN: z.string().optional().default(""),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional().default(""),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional().default("https://us.i.posthog.com"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Validated process.env access. Throws early (at boot) rather than at first use if misconfigured. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}
