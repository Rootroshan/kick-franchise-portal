import { getEnv } from "@/lib/env";

/**
 * Vercel Domains integration.
 *
 * Proving ownership (a TXT record) and actually SERVING a domain are two
 * different things. Until the domain is registered with the host, DNS points
 * at an edge that is not listening, no certificate is issued, and the portal
 * is unreachable — even though verification passed. That gap is why a domain
 * could read VERIFIED while returning nothing.
 *
 * Every call fails soft: a hosting outage must not break domain management in
 * the admin UI, so callers get a typed result rather than an exception.
 */

type ProviderResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export type DomainHostingStatus = {
  /** Registered on the hosting project at all. */
  attached: boolean;
  /** Hosting provider considers DNS correctly pointed. */
  dnsConfigured: boolean;
  /** A TLS certificate has been issued and the domain is serving. */
  sslReady: boolean;
  /** Provider-reported reason when something is not ready. */
  detail?: string;
};

function config(): { token: string; projectId: string; teamQuery: string } | null {
  const env = getEnv() as Record<string, unknown>;
  const token = typeof env.VERCEL_API_TOKEN === "string" ? env.VERCEL_API_TOKEN : "";
  const projectId = typeof env.VERCEL_PROJECT_ID === "string" ? env.VERCEL_PROJECT_ID : "";
  if (!token || !projectId) return null;

  const teamId = typeof env.VERCEL_TEAM_ID === "string" ? env.VERCEL_TEAM_ID : "";
  return { token, projectId, teamQuery: teamId ? `?teamId=${encodeURIComponent(teamId)}` : "" };
}

/** Whether the hosting integration is configured at all. */
export function isHostingConfigured(): boolean {
  return config() !== null;
}

/** The CNAME target owners must point at. Derived, never hard-coded per brand. */
export function cnameTarget(): string {
  return "cname.vercel-dns.com";
}

async function call<T>(path: string, init?: RequestInit): Promise<ProviderResult<T>> {
  const cfg = config();
  if (!cfg) return { ok: false, message: "Hosting integration is not configured." };

  try {
    const res = await fetch(`https://api.vercel.com${path}${cfg.teamQuery}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      // Surface the provider's own wording, which is usually actionable
      // ("domain already in use"), but never the token or raw response.
      const err = body.error as { message?: string } | undefined;
      return { ok: false, message: err?.message ?? `Hosting provider returned ${res.status}.` };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, message: "Could not reach the hosting provider. Try again shortly." };
  }
}

/** Registers the domain on the hosting project so it begins serving. */
export async function attachDomain(hostname: string): Promise<ProviderResult<{ hostname: string }>> {
  const cfg = config();
  if (!cfg) return { ok: false, message: "Hosting integration is not configured." };

  const res = await call<Record<string, unknown>>(`/v10/projects/${cfg.projectId}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: hostname }),
  });

  // Already attached is a success from our side — the desired end state holds.
  if (!res.ok && /already/i.test(res.message)) return { ok: true, data: { hostname } };
  if (!res.ok) return res;
  return { ok: true, data: { hostname } };
}

/** Removes the domain from the hosting project. */
export async function detachDomain(hostname: string): Promise<ProviderResult<null>> {
  const cfg = config();
  if (!cfg) return { ok: false, message: "Hosting integration is not configured." };

  const res = await call<Record<string, unknown>>(
    `/v9/projects/${cfg.projectId}/domains/${encodeURIComponent(hostname)}`,
    { method: "DELETE" }
  );
  // A domain that is already gone is the desired end state.
  if (!res.ok && /not found/i.test(res.message)) return { ok: true, data: null };
  if (!res.ok) return { ok: false, message: res.message };
  return { ok: true, data: null };
}

/**
 * Reads live hosting status: attached, DNS pointed, certificate issued.
 *
 * This is what makes "SSL provisioning" and "Active" real states rather than
 * guesses — both are reported by the provider, not inferred locally.
 */
export async function getDomainHostingStatus(hostname: string): Promise<DomainHostingStatus> {
  const cfg = config();
  if (!cfg) return { attached: false, dnsConfigured: false, sslReady: false, detail: "Hosting not configured." };

  const domain = await call<{ verified?: boolean }>(
    `/v9/projects/${cfg.projectId}/domains/${encodeURIComponent(hostname)}`
  );
  if (!domain.ok) {
    return { attached: false, dnsConfigured: false, sslReady: false, detail: domain.message };
  }

  const cfgRes = await call<{ misconfigured?: boolean }>(
    `/v6/domains/${encodeURIComponent(hostname)}/config`
  );
  const misconfigured = cfgRes.ok ? cfgRes.data.misconfigured === true : true;

  return {
    attached: true,
    dnsConfigured: !misconfigured,
    // Vercel issues the certificate once DNS resolves correctly, so a
    // correctly-pointed attached domain is serving over TLS.
    sslReady: !misconfigured && domain.data.verified !== false,
    detail: misconfigured ? "DNS records are not pointing at the platform yet." : undefined,
  };
}
