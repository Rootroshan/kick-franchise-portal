/**
 * Custom-domain hostname normalisation.
 *
 * Domains are matched against the request's Host header, which arrives
 * lowercase and bare — no scheme, no port, no path. A stored value that keeps
 * any of those can never match, so the domain verifies but never routes. This
 * normalises input to exactly the shape resolveTenantFromHost compares against.
 */

export type NormaliseResult = { ok: true; hostname: string } | { ok: false; message: string };

// Label rules per RFC 1123: alphanumeric plus internal hyphens, 1–63 chars.
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function normaliseHostname(raw: string): NormaliseResult {
  let value = raw.trim().toLowerCase();
  if (!value) return { ok: false, message: "Enter a domain." };

  // Strip a scheme if the user pasted a URL.
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  // Strip credentials, path, query and fragment.
  value = value.split("/")[0] ?? "";
  value = value.split("?")[0] ?? "";
  value = value.split("#")[0] ?? "";
  if (value.includes("@")) value = value.split("@").pop() ?? "";
  // Strip a port — Host may include one, but the stored domain must not.
  value = value.split(":")[0] ?? "";
  // Trailing dot is valid DNS but never appears in a Host header.
  value = value.replace(/\.$/, "");

  if (!value) return { ok: false, message: "Enter a valid domain." };
  if (value.length > 253) return { ok: false, message: "That domain is too long." };

  const labels = value.split(".");
  if (labels.length < 3) {
    // A root domain (example.com) would take over the apex, which the platform
    // does not serve. Portals live on a subdomain.
    return { ok: false, message: "Use a subdomain such as portal.yourbrand.com, not a root domain." };
  }
  if (labels.some((l) => !LABEL.test(l))) {
    return { ok: false, message: "That domain contains invalid characters." };
  }

  return { ok: true, hostname: value };
}

/** The DNS record name the owner must create, given a normalised hostname. */
export function verificationRecordName(hostname: string): string {
  return `_kick-verify.${hostname}`;
}

/**
 * The host label most DNS providers expect for the CNAME.
 *
 * Providers disagree: some want just the subdomain label ("portal"), others
 * want the full hostname. Both are surfaced in the UI so the operator can pick
 * whichever their provider accepts.
 */
export function shortHostLabel(hostname: string): string {
  return hostname.split(".")[0] ?? hostname;
}
