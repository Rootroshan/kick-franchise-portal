import { z } from "zod";

export const tenantThemeSchema = z.object({
  logoUrl: z.union([z.string().url(), z.literal("")]).optional().default(""),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#111827"),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#6b7280"),
  font: z.string().optional().default("Inter"),
});

export type TenantTheme = z.infer<typeof tenantThemeSchema>;

export function parseTenantTheme(raw: unknown): TenantTheme {
  const result = tenantThemeSchema.safeParse(raw);
  if (result.success) return result.data;
  return tenantThemeSchema.parse({});
}

function hexToRgbString(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Produces inline CSS custom properties for a tenant's branding — applied on the root layout. */
export function themeToCssVariables(theme: TenantTheme): string {
  return [
    `--tenant-primary: ${theme.primary};`,
    `--tenant-primary-rgb: ${hexToRgbString(theme.primary)};`,
    `--tenant-secondary: ${theme.secondary};`,
    `--tenant-secondary-rgb: ${hexToRgbString(theme.secondary)};`,
    `--tenant-font: ${theme.font}, system-ui, sans-serif;`,
  ].join(" ");
}
