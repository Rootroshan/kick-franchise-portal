/**
 * DEV-ONLY escape hatch so the app can run on localhost before a real Clerk
 * account exists. Requires BOTH NODE_ENV=development AND DEV_BYPASS_AUTH=true,
 * so there is no path for this to activate in a deployed environment. Never
 * set DEV_BYPASS_AUTH outside a local .env.local file (see .env.example,
 * which deliberately omits it).
 */
export function isDevBypassEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "true";
}
