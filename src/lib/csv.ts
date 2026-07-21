/**
 * Quotes a CSV cell and neutralizes formula injection: a cell starting with
 * =, +, -, @, tab, or CR is interpreted as a formula by Excel/Sheets when the
 * file is opened, so any user-controlled field (name, email, brand/location
 * name, actor id) must be guarded before being written to an export.
 */
export function csvCell(value: string | null | undefined): string {
  const s = (value ?? "").replace(/"/g, '""');
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${guarded}"`;
}
