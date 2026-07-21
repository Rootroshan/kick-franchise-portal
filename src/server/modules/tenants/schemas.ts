import { z } from "zod";

// Shared across create/update: url() alone accepts javascript: and data: —
// both are well-formed URLs and both become stored XSS the moment the value
// is rendered into an href. Restricting the scheme here is the authoritative
// check; the render site re-checks as defence in depth.
const websiteSchema = z
  .string()
  .url()
  .refine((v) => /^https?:\/\//i.test(v), "Website must start with http:// or https://");

const themeSchema = z.object({
  logoUrl: z.string().url().optional(),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  font: z.string().optional(),
});

/**
 * Brand creation requires real franchisor contact info up front — a brand
 * cannot be created with only a name, since email/phone/address are how the
 * franchisor is actually reached and how a future invitation would be sent.
 */
export const createTenantSchema = z.object({
  name: z.string().trim().min(1, "Enter a brand name.").max(200),
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Lowercase letters, numbers, and hyphens only; cannot start/end with a hyphen"),
  legalName: z.string().trim().max(200).optional(),
  contactName: z.string().trim().min(1, "Enter the franchisor contact's name."),
  email: z.string().trim().email("Enter a valid franchisor email."),
  phone: z.string().trim().min(1, "Enter a franchisor phone number.").max(50),
  addressLine1: z.string().trim().min(1, "Enter a street address.").max(300),
  addressCity: z.string().trim().min(1, "Enter a city.").max(120),
  addressState: z.string().trim().min(1, "Enter a state or province.").max(120),
  addressPostalCode: z.string().trim().min(1, "Enter a postal code.").max(30),
  addressCountry: z.string().trim().min(1, "Enter a country.").max(120),
  website: websiteSchema.or(z.literal("")).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  clerkOrgId: z.string().min(1).nullable().optional(),
  theme: themeSchema.optional().default({}),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  legalName: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  // Contact details. Each accepts "" so a field can be CLEARED — email()/url()
  // alone would reject the empty string a form sends when emptying an input,
  // making it impossible to remove a value once set.
  tagline: z.string().max(200).optional(),
  hqAddress: z.string().max(500).optional(),
  addressLine1: z.string().max(300).optional(),
  addressCity: z.string().max(120).optional(),
  addressState: z.string().max(120).optional(),
  addressPostalCode: z.string().max(30).optional(),
  addressCountry: z.string().max(120).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  website: websiteSchema.or(z.literal("")).optional(),
  theme: themeSchema.optional(),
});

/**
 * Store creation requires full contact/manager info up front — a store
 * cannot be created with only a name, since address/phone/email/manager are
 * required for it to be a reachable, operable location.
 */
export const createLocationSchema = z.object({
  name: z.string().trim().min(1, "Enter a store name.").max(200),
  storeCode: z.string().trim().min(1, "Enter a store number or code.").max(50),
  addressLine1: z.string().trim().min(1, "Enter a street address.").max(300),
  addressCity: z.string().trim().min(1, "Enter a city.").max(120),
  addressState: z.string().trim().min(1, "Enter a state or province.").max(120),
  addressPostalCode: z.string().trim().min(1, "Enter a postal code.").max(30),
  addressCountry: z.string().trim().min(1, "Enter a country.").max(120),
  phone: z.string().trim().min(1, "Enter a store phone number.").max(50),
  email: z.string().trim().email("Enter a valid store email."),
  managerName: z.string().trim().min(1, "Enter the manager's name.").max(200),
  managerEmail: z.string().trim().email("Enter a valid manager email."),
  managerPhone: z.string().trim().min(1, "Enter the manager's phone number.").max(50),
  status: z.enum(["active", "inactive"]).optional(),
});

export const updateLocationSchema = createLocationSchema.partial();

export const createCustomDomainSchema = z.object({
  hostname: z
    .string()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, "Must be a valid hostname"),
});

/**
 * Every field a real account needs to receive an invitation and log in — no
 * raw internal/Clerk user ID is ever accepted from the caller. locationId is
 * required whenever role is FRANCHISEE_USER: a store-level account with no
 * store is not a valid state.
 */
export const createMembershipSchema = z
  .object({
    displayName: z.string().trim().min(1, "Enter a full name.").max(200),
    email: z.string().trim().email("Enter a valid email."),
    phone: z.string().trim().max(50).optional(),
    locationId: z.string().uuid().nullable().optional(),
    role: z.enum(["FRANCHISOR_ADMIN", "FRANCHISEE_USER"]),
    storeRole: z.enum(["MANAGER", "USER"]).nullable().optional(),
  })
  .refine((v) => v.role !== "FRANCHISEE_USER" || !!v.locationId, {
    message: "Select a store for this user.",
    path: ["locationId"],
  });
