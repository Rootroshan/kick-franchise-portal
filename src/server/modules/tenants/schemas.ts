import { z } from "zod";

export const createTenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Lowercase letters, numbers, and hyphens only; cannot start/end with a hyphen"),
  clerkOrgId: z.string().min(1).nullable().optional(),
  theme: z
    .object({
      logoUrl: z.string().url().optional(),
      primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      font: z.string().optional(),
    })
    .optional()
    .default({}),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  // Contact details. Each accepts "" so a field can be CLEARED — email()/url()
  // alone would reject the empty string a form sends when emptying an input,
  // making it impossible to remove a value once set.
  hqAddress: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  // url() alone accepts javascript: and data: — both are well-formed URLs and
  // both become stored XSS the moment the value is rendered into an href.
  // Restricting the scheme here is the authoritative check; the render site
  // re-checks as defence in depth.
  website: z
    .string()
    .url()
    .refine((v) => /^https?:\/\//i.test(v), "Website must start with http:// or https://")
    .or(z.literal(""))
    .optional(),
  theme: z
    .object({
      logoUrl: z.string().url().optional(),
      primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      font: z.string().optional(),
    })
    .optional(),
});

export const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).nullable().optional(),
});

export const createCustomDomainSchema = z.object({
  hostname: z
    .string()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, "Must be a valid hostname"),
});

export const createMembershipSchema = z.object({
  clerkUserId: z.string().min(1),
  locationId: z.string().uuid().nullable().optional(),
  role: z.enum(["FRANCHISOR_ADMIN", "FRANCHISEE_USER"]),
  email: z.string().email().nullable().optional(),
  displayName: z.string().max(200).nullable().optional(),
});
