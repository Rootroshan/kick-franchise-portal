/** Parse admin list-page URL params into a normalized query. Server-side. */
export type AdminListQuery = {
  page: number;
  limit: number;
  search: string;
  status: string;
  brand: string;
  sort: string;
  direction: "asc" | "desc";
  from?: string;
  to?: string;
  date?: string;
  raw: Record<string, string>;
};

export function parseListQuery(searchParams: Record<string, string | string[] | undefined>): AdminListQuery {
  const get = (k: string) => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(5, parseInt(get("limit") || "20", 10) || 20));
  const direction = get("direction") === "asc" ? "asc" : "desc";
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    if (v != null) raw[k] = Array.isArray(v) ? v[0] ?? "" : v;
  }
  return {
    page,
    limit,
    search: get("search").trim(),
    status: get("status"),
    brand: get("brand"),
    sort: get("sort"),
    direction,
    from: get("from") || undefined,
    to: get("to") || undefined,
    date: get("date") || undefined,
    raw,
  };
}

/** Build a URL that keeps existing params but overrides some. */
export function buildHref(basePath: string, current: Record<string, string>, overrides: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams(current);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") params.delete(k);
    else params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export const skip = (q: AdminListQuery) => (q.page - 1) * q.limit;
export const pageCount = (total: number, limit: number) => Math.max(1, Math.ceil(total / limit));

/** UTC start/end-of-day bounds for a "YYYY-MM-DD" date key, e.g. the Publish Calendar's `date` filter. */
export const startOfDay = (dateKey: string) => new Date(`${dateKey}T00:00:00.000Z`);
export const endOfDay = (dateKey: string) => new Date(`${dateKey}T24:00:00.000Z`);
