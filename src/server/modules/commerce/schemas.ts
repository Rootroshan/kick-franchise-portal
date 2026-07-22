import { z } from "zod";

/** Store-facing catalog categories. Kept as data (not a DB enum) so adding one
 *  is a deploy, not a migration. Icons/descriptions live in the shop UI. */
export const PRODUCT_CATEGORIES = ["Apparel", "Kitchenware", "Packaging", "Signage", "Promotional"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

const categorySchema = z.enum(PRODUCT_CATEGORIES).nullable().optional();

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(100),
  category: categorySchema,
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().max(1000).nullable().optional(),
  active: z.boolean().optional().default(true),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: categorySchema,
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().max(1000).nullable().optional(),
  active: z.boolean().optional(),
});

export const createVariantSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().min(1).max(200),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3).optional().default("CAD"),
  stock: z.number().int().nonnegative().nullable().optional(),
  active: z.boolean().optional().default(true),
});

export const updateVariantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  priceCents: z.number().int().nonnegative().optional(),
  stock: z.number().int().nonnegative().nullable().optional(),
  active: z.boolean().optional(),
});

export const createOrderingRuleSchema = z.object({
  locationId: z.string().uuid(),
  productId: z.string().uuid().nullable().optional(),
  minQty: z.number().int().positive().nullable().optional(),
  maxQty: z.number().int().positive().nullable().optional(),
  cadenceDays: z.number().int().positive().nullable().optional(),
});

export const cartItemSchema = z.object({
  variantId: z.string().uuid(),
  qty: z.number().int().positive().max(10_000),
});

export const checkoutRequestSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(200),
  idempotencyKey: z.string().min(8).max(200),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
