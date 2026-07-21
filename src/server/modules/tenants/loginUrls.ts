/**
 * Portal login URLs are derived from a domain, never stored — when a brand's
 * portal domain changes, both links update automatically because there is
 * nothing to go stale.
 */
export function portalLoginUrls(hostname: string): { adminLoginUrl: string; storeLoginUrl: string } {
  return {
    adminLoginUrl: `https://${hostname}/admin-login`,
    storeLoginUrl: `https://${hostname}/store-login`,
  };
}
